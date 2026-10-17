import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "../types";

// Verified against Cloudflare's official model catalog/schema on 2026-10-16.
export const CLOUDFLARE_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX_OUTPUT_TOKENS = 8_192;
const MAX_TEXT_BYTES = 65_536;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
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

function prepareBody(request: AiGenerationRequest): string {
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
  const body = JSON.stringify({
    messages: [{ role: "user", content }],
    // Cloudflare's native API accepts the bare schema, unlike Groq's envelope.
    response_format: { type: "json_schema", json_schema: request.responseSchema },
    max_tokens: MAX_OUTPUT_TOKENS, stream: false,
  });
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new AiRoutingError("INPUT_TOO_LARGE");
  return body;
}

async function sendRequest(url: string, apiToken: string, body: string, signal: AbortSignal): Promise<AiGenerationResult> {
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
      const body = prepareBody(request);
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
          sendRequest(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_MODEL}`, apiToken, body, controller.signal),
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
