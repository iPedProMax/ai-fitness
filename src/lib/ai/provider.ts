import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import type { AiProvider } from "./types";
import { generateWithFallback } from "./router";
import { guardProvider } from "./request-control";

/** Strict model selection: never silently reroute a user to another provider. */
export function getAiProvider(model: string = "gemini"): AiProvider | null {
  if (model !== "gemini" || !process.env.GEMINI_API_KEY) return null;
  const gemini = guardProvider(createGeminiProvider(process.env.GEMINI_API_KEY));
  return { ...gemini, generate: request => generateWithFallback([gemini], request) };
}
