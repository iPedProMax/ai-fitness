import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiGenerationRequest, AiProvider } from "../types";

// Verified using a live, base64-encoded image test and the official Groq vision docs.
export const GROQ_MODEL = "qwen/qwen3.8-27b";
export const GROQ_MAX_IMAGES = 2;
export const GROQ_MAX_BODY_BYTES = 19 * 1024 * 1024;
export function groqCompletionTokens(imageCount: number): number { return imageCount === 3 ? 768 : 1024; }
// A compact JSON contract leaves room for three photos under Groq Free's 8K TPM.
// Optional brand/scale/clarification signals can be absent; the canonical route
// still validates all required nutrition numbers before a result is displayed.
const shortFoodProperties = Object.fromEntries(["name", "estimatedGrams", "calories", "protein", "carbs", "fat", "confidence"].map(name =>
  [name, { type: name === "name" ? "string" : "number" }]));
export const GROQ_THREE_PHOTO_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    foods: { type: "array", items: { type: "object", properties: shortFoodProperties,
      required: ["name", "estimatedGrams", "calories", "protein", "carbs", "fat", "confidence"] } },
    totalCalories: { type: "number" }, notes: { type: "string" },
    clarifications: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, foodIndex: { type: "number" },
      question: { type: "string" }, options: { type: "array", items: { type: "string" } },
    }, required: ["id", "foodIndex", "question", "options"] } },
  }, required: ["foods", "totalCalories", "notes", "clarifications"],
};
export function groqResponseSchema(schema: Record<string, unknown>, images: number): Record<string, unknown> {
  return images === 3 ? GROQ_THREE_PHOTO_SCHEMA : schema;
}
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const responseSchema = z.object({ choices: z.array(z.object({
  message: z.object({ content: z.string().nullable() }),
  finish_reason: z.string().nullable(),
})).min(1) });

function toBody(request: AiGenerationRequest): string {
  const images = request.input.filter(part => part.type === "image");
  if (images.length > GROQ_MAX_IMAGES) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  if (!request.input.some(part => part.type === "text")) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  const content = request.input.map(part => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (!imageTypes.has(part.mimeType) || !part.data || part.data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(part.data)) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
    return { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
  });
  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [{ role: "user", content }],
    response_format: { type: "json_schema", json_schema: {
      name: "nutrition", strict: false, schema: groqResponseSchema(request.responseSchema, images.length),
    } },
    reasoning_effort: "none",
    max_completion_tokens: groqCompletionTokens(images.length),
  });
  if (Buffer.byteLength(body, "utf8") > GROQ_MAX_BODY_BYTES) throw new AiRoutingError("INPUT_TOO_LARGE");
  return body;
}

/** Transport only. Staging flags, DB quotas and credit accounting stay elsewhere. */
export function createGroqProvider(apiKey: string, enabled = false): AiProvider {
  return {
    id: "groq", enabled, available: Boolean(apiKey),
    capabilities: { text: true, vision: true, maxImages: GROQ_MAX_IMAGES, structuredJson: true },
    async generate(request) {
      if (!enabled || !apiKey) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      const body = toBody(request); // Reject bad inputs before network requests.
      const signal = AbortSignal.any([AbortSignal.timeout(40_000), ...(request.signal ? [request.signal] : [])]);
      let response: Response;
      try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", redirect: "error", signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body,
        });
      } catch (error) {
        if (signal.aborted) throw new AiRoutingError(request.signal?.aborted ? "CANCELLED" : "TIMEOUT");
        if (error instanceof TypeError) throw Object.assign(new Error("Provider connection failed"), { name: "ConnectionError" });
        throw new Error("Provider request failed");
      }
      if (!response.ok) {
        // Never propagate upstream response bodies, headers, or credentials.
        throw Object.assign(new Error("Provider request rejected"), { status: response.status });
      }
      const parsed = responseSchema.parse(await response.json());
      if (parsed.choices[0].finish_reason !== "stop") throw new Error("Provider output incomplete");
      return { outputText: parsed.choices[0].message.content ?? undefined };
    },
  };
}
