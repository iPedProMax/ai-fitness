import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiGenerationRequest, AiProvider } from "../types";

/** Dedicated offline Text AI model. Do not send image requests to this adapter. */
export const OLLAMA_TEXT_MODEL = "qwen2.5:3b";
const OLLAMA_TEXT_ENDPOINT = "http://127.0.0.1:11434/api/chat";
const completion = z.object({
  message: z.object({ content: z.string() }),
  done: z.literal(true),
  done_reason: z.string().optional(),
});
export function ollamaTextBody(request: AiGenerationRequest): string {
  if (request.input.some(part => part.type !== "text") || !request.input.some(part => part.type === "text")) {
    throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  }
  const prompt = request.input.filter(part => part.type === "text")
    .map(part => part.type === "text" ? part.text : "").join("\n\n");
  // Phase U7: small coach-specific output budget; preserve full nutrition JSON capacity.
  const required = request.responseSchema.required;
  const coachReplyOnly = Array.isArray(required) && required.length === 1 && required[0] === "reply";
  const body = JSON.stringify({
    model: OLLAMA_TEXT_MODEL,
    messages: [
      { role: "system", content: "Return one JSON object exactly matching the requested schema. Never invent nutrition labels, amounts, or verified facts." },
      { role: "user", content: prompt },
    ],
    format: request.responseSchema,
    stream: false,
    options: { temperature: 0, num_predict: coachReplyOnly ? 480 : 1800 },
    keep_alive: "10m",
  });
  if (Buffer.byteLength(body, "utf8") > 256 * 1024) throw new AiRoutingError("INPUT_TOO_LARGE");
  return body;
}
export function createOllamaTextProvider(enabled = false): AiProvider {
  const allowed = enabled && process.env.NODE_ENV === "development";
  return {
    id: "ollama-local", enabled: allowed, available: allowed,
    capabilities: { text: true, vision: false, maxImages: 0, structuredJson: true },
    async generate(request) {
      if (!allowed || process.env.NODE_ENV !== "development") throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      const body = ollamaTextBody(request);
      const signal = AbortSignal.any([AbortSignal.timeout(90_000), ...(request.signal ? [request.signal] : [])]);
      let response: Response;
      try {
        response = await fetch(OLLAMA_TEXT_ENDPOINT, {
          method: "POST", redirect: "error", signal,
          headers: { "Content-Type": "application/json" }, body,
        });
      } catch (error) {
        if (signal.aborted) throw new AiRoutingError(request.signal?.aborted ? "CANCELLED" : "TIMEOUT");
        if (error instanceof TypeError) throw Object.assign(new Error("Local Ollama not running"), { name: "ConnectionError" });
        throw new Error("Local text model failed");
      }
      if (!response.ok) throw Object.assign(new Error("Local Ollama request rejected"), { status: response.status });
      const result = completion.parse(await response.json());
      if ((result.done_reason && result.done_reason !== "stop") || !result.message.content.trim()) {
        throw new Error("Local model output incomplete");
      }
      return { outputText: result.message.content };
    },
  };
}