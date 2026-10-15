import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "../types";

// Preserve the current model and Interactions API behavior during extraction.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

export function createGeminiProvider(apiKey: string): AiProvider {
  return {
    id: "gemini",
    async generate({ input, responseSchema }) {
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
      });

      // Leave empty output, JSON parsing, Zod checks, and errors to the routes.
      return { outputText: interaction.output_text };
    },
  };
}
