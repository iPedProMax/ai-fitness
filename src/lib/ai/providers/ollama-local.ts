import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiGenerationRequest, AiProvider } from "../types";

/** Local inference only. Never use the user's Ollama Cloud API key or cloud URL. */
export const OLLAMA_LOCAL_MODEL = "qwen2.5vl:3b";
export const OLLAMA_LOCAL_ENDPOINT = "http://127.0.0.1:11434/api/chat";
export const OLLAMA_LOCAL_MAX_IMAGES = 1;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const acceptedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const responseSchema = z.object({
  message: z.object({ content: z.string() }),
  done: z.literal(true),
  done_reason: z.string().optional(),
});

export function ollamaLocalBody(request: AiGenerationRequest): string {
  const photos = request.input.filter(part => part.type === "image");
  if (photos.length > OLLAMA_LOCAL_MAX_IMAGES || !request.input.some(part => part.type === "text")) {
    throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  }
  const prompt = request.input.filter(part => part.type === "text").map(part => part.type === "text" ? part.text : "").join("\n\n");
  const images = photos.map(part => {
    if (part.type !== "image" || !acceptedMime.has(part.mimeType) || !part.data ||
        part.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(part.data)) {
      throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
    }
    return part.data;
  });
  const body = JSON.stringify({
    model: OLLAMA_LOCAL_MODEL,
    messages: [{ role: "system", content: "Return exactly one JSON object matching the requested JSON schema. For nutrition tasks, do not invent scale digits, unseen labels, foods, or calorie data. For coaching tasks, put the answer in the requested reply field." },
      { role: "user", content: prompt, ...(images.length ? { images } : {}) }],
    format: request.responseSchema,
    stream: false,
    options: { temperature: 0, num_predict: 1600 },
    keep_alive: "2m",
  });
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new AiRoutingError("INPUT_TOO_LARGE");
  return body;
}

/** Only enabled in a Node.js development server running on the same PC as Ollama. */
export function createOllamaLocalProvider(enabled = false): AiProvider {
  const allowed = enabled && process.env.NODE_ENV !== "production";
  return {
    id: "ollama-local", enabled: allowed, available: allowed,
    capabilities: { text: true, vision: true, maxImages: OLLAMA_LOCAL_MAX_IMAGES, structuredJson: true },
    async generate(request) {
      if (!allowed || process.env.NODE_ENV === "production") throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      const body = ollamaLocalBody(request);
      const signal = AbortSignal.any([AbortSignal.timeout(90_000), ...(request.signal ? [request.signal] : [])]);
      let response: Response;
      try {
        response = await fetch(OLLAMA_LOCAL_ENDPOINT, {
          method: "POST", redirect: "error", signal,
          headers: { "Content-Type": "application/json" }, body,
        });
      } catch (error) {
        if (signal.aborted) throw new AiRoutingError(request.signal?.aborted ? "CANCELLED" : "TIMEOUT");
        if (error instanceof TypeError) throw Object.assign(new Error("Local Ollama not running"), { name: "ConnectionError" });
        throw new Error("Local model failed");
      }
      if (!response.ok) throw Object.assign(new Error("Local Ollama request rejected"), { status: response.status });
      const result = responseSchema.parse(await response.json());
      if ((result.done_reason && result.done_reason !== "stop") || !result.message.content.trim()) {
        throw new Error("Local model output incomplete");
      }
      return { outputText: result.message.content };
    },
  };
}