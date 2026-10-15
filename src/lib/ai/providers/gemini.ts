import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "../types";

// Preserve the current model and Interactions API behavior during extraction.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

export function createGeminiProvider(apiKey: string): AiProvider {
  return {
    id: "gemini",
    enabled: true,
    available: true,
    // Preserve the application's existing ten-image range, not a new model claim.
    capabilities: { text: true, vision: true, maxImages: 10, structuredJson: true },
    async generate({ input, responseSchema, signal }) {
      // Construct lazily: routes verify configuration before reserving credits,
      // but do not reach the SDK until their existing reservation succeeds.
      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create({
        model: GEMINI_MODEL,
        input: input.map((part) => part.type === "text"
          ? { type: "text" as const, text: part.text }
          : { type: "image" as const, data: part.data, mime_type: part.mimeType }),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
      }, { signal, timeout_ms: 20_000, retries: { strategy: "none" } });

      // Leave empty output, JSON parsing, Zod checks, and errors to the routes.
      return { outputText: interaction.output_text };
    },
  };
}
