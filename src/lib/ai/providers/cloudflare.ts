import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import { foodAnalysisSchema } from "@/lib/food-analysis";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "../types";

// Verified against Cloudflare's official model catalog/schema on 2026-10-16.
// One-photo scans use the verified fast vision endpoint. Text-only refinements
// retain the current text endpoint until their own end-to-end validation.
export const CLOUDFLARE_MODEL = "@cf/moondream/moondream3.1-9B-A2B";
export const CLOUDFLARE_TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MOONDREAM_QUERY = `Inspect this ONE food-related photo. Reply ONLY with a valid JSON object, no Markdown. Output exactly this shape: {"foods":[{"name":"food name","estimatedGrams":200,"calories":300,"protein":10,"carbs":45,"fat":8,"confidence":0.6}],"totalCalories":300,"notes":"short assumptions","clarifications":[]}. Values must be realistic estimates, not exact claims. Confidence is 0 to 1 and never above 0.8 for a visual guess. If this is packaging or nutrition facts, prefer readable label figures scaled by servings. A scale with a container is NOT confirmed tared: do not mark container weight as food-only measured weight. Don't double-count packaging and its food; don't invent invisible ingredients. For mixed foods, split only clearly distinct portions. If the picture cannot provide reasonable evidence, return {"foods":[],"totalCalories":0,"notes":"Insufficient evidence","clarifications":[]}.`;
const MAX_OUTPUT_TOKENS = 2_048;
const MAX_TEXT_BYTES = 65_536;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const objectResponse = z.record(z.string(), z.unknown());
const envelopeSchema = z.object({
  success: z.literal(true),
  result: z.object({ response: z.union([z.string().min(1), objectResponse]) }),
});

type CloudflareCredentials = { accountId: string; apiToken: string };
class CloudflareProviderError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "CloudflareProviderError"; }
}

function validCredentials({ accountId, apiToken }: CloudflareCredentials) {
  return /^[a-f0-9]{32}$/i.test(accountId) && /^[\x21-\x7e]+$/.test(apiToken);
}

function prepareBody(request: AiGenerationRequest): { body: string; model: string; vision: boolean } {
  // An initial APPLICATION limit, not a claim about the model's maximum. Keep
  // evidence intact: requests with more images must use another provider.
  if (request.input.filter(part => part.type === "image").length > 1) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  const text = request.input.filter(part => part.type === "text");
  if (Buffer.byteLength(JSON.stringify({ text, schema: request.responseSchema }), "utf8") > MAX_TEXT_BYTES) {
    throw new AiRoutingError("INPUT_TOO_LARGE");
  }
  const content = request.input.map(part => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (!imageTypes.has(part.mimeType) || !part.data || part.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(part.data)) {
      throw new CloudflareProviderError("Invalid image input.");
    }
    return { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
  });
  const vision = request.input.some(part => part.type === "image");
  if (vision) {
    const image = content.find(item => item.type === "image_url");
    if (!image || !image.image_url) throw new CloudflareProviderError("Missing food photo.");
    const body = JSON.stringify({ task: "query", image: image.image_url.url,
      question: MOONDREAM_QUERY, reasoning: false, stream: false, max_tokens: 900 });
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new AiRoutingError("INPUT_TOO_LARGE");
    return { body, model: CLOUDFLARE_MODEL, vision: true };
  }
  const body = JSON.stringify({
    messages: [{ role: "user", content }],
    // Cloudflare's native API accepts the bare schema, unlike Groq's envelope.
    response_format: { type: "json_schema", json_schema: request.responseSchema },
    max_tokens: MAX_OUTPUT_TOKENS, stream: false,
  });
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new AiRoutingError("INPUT_TOO_LARGE");
  return { body, model: CLOUDFLARE_TEXT_MODEL, vision: false };
}


/** A vision answer is untrusted: accept only evidenced numeric nutrition fields.
 * No fabricated calories/macros, no unknown container weights marked as measured. */
function normalizeMoondreamAnswer(answer: string): string {
  let raw: unknown;
  try {
    const cleaned = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    raw = JSON.parse(cleaned);
  } catch { throw new CloudflareProviderError("Moondream returned invalid nutrition JSON."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CloudflareProviderError("Moondream returned invalid nutrition data.");
  const object = raw as Record<string, unknown>;
  const values = Array.isArray(object.foods) ? object.foods : [object];
  if (values.length === 0 || values.length > 4) throw new CloudflareProviderError("Moondream could not identify a food portion.");
  const foods = values.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CloudflareProviderError("Incomplete Moondream nutrition.");
    const item = value as Record<string, unknown>;
    const pick = (camel: string, snake: string) => item[camel] ?? item[snake];
    const number = (first: string, second: string) => {
      const value = pick(first, second);
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new CloudflareProviderError("Incomplete Moondream nutrition.");
      return value;
    };
    const name = pick("name", "food_name");
    if (typeof name !== "string" || !name.trim()) throw new CloudflareProviderError("Missing food identity.");
    const rawConfidence = typeof item.confidence === "number" && Number.isFinite(item.confidence)
      ? item.confidence : 0.5;
    const confidence = Math.min(0.8, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence);
    if (confidence < 0) throw new CloudflareProviderError("Invalid nutrition confidence.");
    return {
      name: name.trim(),
      estimatedGrams: number("estimatedGrams", "estimated_grams"),
      calories: number("calories", "calories_kcal"),
      protein: number("protein", "protein_g"),
      carbs: number("carbs", "carbs_g"),
      fat: number("fat", "fat_g"),
      confidence,
      brandStatus: ["KNOWN", "UNKNOWN_RELEVANT", "NOT_RELEVANT"].includes(String(item.brandStatus)) ? item.brandStatus : "NOT_RELEVANT",
      varietyStatus: ["KNOWN", "UNKNOWN_RELEVANT", "NOT_RELEVANT"].includes(String(item.varietyStatus)) ? item.varietyStatus : "NOT_RELEVANT",
      materialUncertaintyPresent: item.materialUncertaintyPresent === true &&
        !!item.proposedClarification && typeof item.proposedClarification === "object",
      ...(item.proposedClarification && typeof item.proposedClarification === "object" ? { proposedClarification: item.proposedClarification } : {}),
      // Never treat a visually displayed scale weight as tared food-only weight.
      weightSource: "AI_ESTIMATE" as const,
      nutritionSource: "AI_ESTIMATE" as const,
    };
  });
  const parsed = foodAnalysisSchema.safeParse({
    foods, totalCalories: foods.reduce((sum, food) => sum + food.calories, 0),
    notes: typeof object.notes === "string" ? object.notes : typeof object.assumptions === "string" ? object.assumptions : "Visual nutrition estimate; verify portions.",
    clarifications: Array.isArray(object.clarifications) ? object.clarifications : [],
  });
  if (!parsed.success) throw new CloudflareProviderError("Moondream nutrition does not match the food schema.");
  return JSON.stringify(parsed.data);
}

async function sendRequest(url: string, apiToken: string, body: string, signal: AbortSignal, vision: boolean): Promise<AiGenerationResult> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", redirect: "error", signal,
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" }, body });
  } catch (error) {
    if (error instanceof TypeError) {
      throw Object.assign(new CloudflareProviderError("Cloudflare connection failed."), { name: "ConnectionError" });
    }
    throw new CloudflareProviderError("Cloudflare request failed.");
  }
  if (!response.ok) throw new CloudflareProviderError("Cloudflare request rejected.", response.status);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new CloudflareProviderError("Cloudflare returned invalid JSON."); }
  if (vision) {
    const outer = z.object({ success: z.literal(true), result: z.unknown() }).safeParse(payload);
    if (!outer.success || !outer.data.result || typeof outer.data.result !== "object") {
      throw new CloudflareProviderError("Moondream returned an invalid response.");
    }
    const wrapped = outer.data.result as Record<string, unknown>;
    const inner = wrapped.result && typeof wrapped.result === "object"
      ? wrapped.result as Record<string, unknown> : wrapped;
    if (inner.finish_reason === "length") throw new CloudflareProviderError("Moondream output was truncated.");
    if (typeof inner.answer !== "string" || !inner.answer.trim()) throw new CloudflareProviderError("Moondream returned no image answer.");
    return { outputText: normalizeMoondreamAnswer(inner.answer) };
  }
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) throw new CloudflareProviderError("Cloudflare returned an invalid response.");
  const result = parsed.data.result.response;
  // Object JSON can be returned directly in native JSON mode. Preserve strings
  // verbatim; canonical nutrition/additive Zod validation remains in the routes.
  let json: unknown;
  try { json = typeof result === "string" ? JSON.parse(result) : result; }
  catch { throw new CloudflareProviderError("Cloudflare returned invalid JSON."); }
  if (!objectResponse.safeParse(json).success) throw new CloudflareProviderError("Cloudflare returned an invalid JSON object.");
  return { outputText: typeof result === "string" ? result : JSON.stringify(result) };
}

/** Transport foundation only: not registered, no quota policy, and no live
 * activation flag. The explicit true argument is for mocked tests/future reviewed
 * server wiring. Credentials alone never activate it. */
export function createCloudflareProvider({ accountId, apiToken }: CloudflareCredentials, enabled = false): AiProvider {
  const available = validCredentials({ accountId, apiToken });
  return {
    id: "cloudflare", enabled: enabled === true, available,
    capabilities: { text: true, vision: true, maxImages: 1, structuredJson: true },
    async generate(request) {
      if (enabled !== true || !available) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      if (request.signal?.aborted) throw new AiRoutingError("CANCELLED");
      const { body, model, vision } = prepareBody(request);
      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort();
      let onAbort = () => {};
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new AiRoutingError(timedOut ? "TIMEOUT" : "CANCELLED"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
      request.signal?.addEventListener("abort", cancel, { once: true });
      try {
        if (request.signal?.aborted) { controller.abort(); return await aborted; }
        return await Promise.race([
          sendRequest(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, apiToken, body, controller.signal, vision),
          aborted,
        ]);
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", cancel);
        controller.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

/** Optional server configuration reader. This function does not register or
 * enable a provider and never logs credentials or reads browser-supplied values. */
export function getCloudflareProvider(): AiProvider | null {
  const credentials = { accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    apiToken: process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN ?? "" };
  return validCredentials(credentials) ? createCloudflareProvider(credentials) : null;
}
