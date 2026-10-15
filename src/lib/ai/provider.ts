import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import type { AiProvider } from "./types";
import { generateWithFallback } from "./router";
import { guardProvider } from "./request-control";

/** Only Gemini is enabled. Callers reserve credits once, before generation. */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const gemini = guardProvider(createGeminiProvider(apiKey));
  // No backup registration, key, environment selector, or live fallback traffic.
  return {
    ...gemini,
    generate: request => generateWithFallback([gemini], request),
  };
}
