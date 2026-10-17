import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "../types";
import { GEMINI_MODEL, GEMINI_MAX_OUTPUT_TOKENS, GEMINI_IMAGE_RESOLUTION, geminiTokenReservation } from "../gemini-token-budget";

export function createGeminiProvider(apiKey: string): AiProvider {
  return {
    id: "gemini",
    enabled: true,
    available: true,
    // Preserve the application's existing ten-image range, not a new model claim.
    capabilities: { text: true, vision: true, maxImages: 10, structuredJson: true },
    async generate(request) {
      geminiTokenReservation(request);
      const { input, responseSchema, signal } = request;
      // Construct lazily: routes verify configuration before reserving credits,
      // but do not reach the SDK until their existing reservation succeeds.
      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create({
        model: GEMINI_MODEL,
        input: input.map((part) => part.type === "text"
          ? { type: "text" as const, text: part.text }
          : { type: "image" as const, data: part.data, mime_type: part.mimeType, resolution: GEMINI_IMAGE_RESOLUTION }),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
        generation_config: { max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS },
      }, { signal, timeout_ms: 20_000, retries: { strategy: "none" } });

      if (interaction.status === "incomplete") throw new Error("AI response incomplete.");
      // Leave empty output, JSON parsing, Zod checks, and errors to the routes.
      return { outputText: interaction.output_text };
    },
  };
}
