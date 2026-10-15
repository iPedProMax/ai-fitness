import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import type { AiProvider } from "./types";

/** Only Gemini is enabled. Callers reserve credits once, before generation. */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? createGeminiProvider(apiKey) : null;
}
