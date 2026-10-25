import "server-only";
import { z } from "zod";
import { AiRoutingError } from "../errors";
import type { AiProvider } from "../types";

// Verified against official Groq documentation on 2026-10-15. Text ONLY.
export const GROQ_MODEL = "openai/gpt-oss-20b";
const responseSchema = z.object({ choices: z.array(z.object({
  message: z.object({ content: z.string().nullable() }),
  finish_reason: z.string().nullable(),
})).min(1) });

/** Not registered by the production provider factory. Enabling requires review,
 * verified account terms, database policy, and an approved configuration change. */
export function createGroqProvider(apiKey: string, enabled = false): AiProvider {
  return {
    id: "groq", enabled, available: Boolean(apiKey),
    capabilities: { text: true, vision: false, maxImages: 0, structuredJson: true },
    async generate(request) {
      if (!enabled || !apiKey) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      if (request.input.some(part => part.type !== "text")) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
      const signal = AbortSignal.any([AbortSignal.timeout(20_000), ...(request.signal ? [request.signal] : [])]);
      let response: Response;
      try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", redirect: "error", signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: request.input.map(part => ({ role: "user", content: part.type === "text" ? part.text : "" })),
            // Best-effort schema mode supports the existing optional properties
            // without changing the canonical schema or prompts. Zod stays mandatory.
            response_format: { type: "json_schema", json_schema: {
              name: "nutrition", strict: false, schema: request.responseSchema,
            } },
            max_completion_tokens: 2_048,
          }),
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
