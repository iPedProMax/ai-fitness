import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiProvider, AiGenerationRequest } from "../types";

// Experimental adapter only: the public scanner has NOT activated this provider.
// This is a FIXED model allowlist; never take a model identifier from user input.
export const MISTRAL_MODEL = "ministral-14b-2512";
export const MISTRAL_MAX_IMAGES = 1;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const completion = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable(),
    message: z.object({ content: z.union([z.string(), z.null()]) }),
  })).min(1),
});

export function buildMistralBody(request: AiGenerationRequest): string {
  const images = request.input.filter(part => part.type === "image");
  if (images.length > MISTRAL_MAX_IMAGES || !request.input.some(part => part.type === "text")) {
    throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  }
  const content = request.input.map(part => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (!allowedMime.has(part.mimeType) || !part.data || part.data.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(part.data)) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
    return { type: "image_url", image_url: `data:${part.mimeType};base64,${part.data}` };
  });
  const body = JSON.stringify({
    model: MISTRAL_MODEL,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1300,
  });
  if (Buffer.byteLength(body, "utf8") > 12 * 1024 * 1024) throw new AiRoutingError("INPUT_TOO_LARGE");
  return body;
}

export function createMistralProvider(apiKey: string, enabled = false): AiProvider {
  return {
    id: "mistral", enabled, available: Boolean(apiKey),
    capabilities: { text: true, vision: true, maxImages: MISTRAL_MAX_IMAGES, structuredJson: true },
    async generate(request) {
      if (!enabled || !apiKey) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      const body = buildMistralBody(request);
      const signal = AbortSignal.any([AbortSignal.timeout(45_000), ...(request.signal ? [request.signal] : [])]);
      let response: Response;
      try {
        response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST", redirect: "error", signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body,
        });
      } catch (error) {
        if (signal.aborted) throw new AiRoutingError(request.signal?.aborted ? "CANCELLED" : "TIMEOUT");
        if (error instanceof TypeError) throw Object.assign(new Error("Provider connection failed"), { name: "ConnectionError" });
        throw new Error("Provider request failed");
      }
      if (!response.ok) throw Object.assign(new Error("Provider request rejected"), { status: response.status });
      const parsed = completion.parse(await response.json());
      if (parsed.choices[0].finish_reason !== "stop" || !parsed.choices[0].message.content?.trim()) {
        throw new Error("Provider output incomplete");
      }
      return { outputText: parsed.choices[0].message.content };
    },
  };
}
