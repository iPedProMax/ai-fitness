import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import { createMistralProvider } from "./providers/mistral";
import type { AiProvider } from "./types";
import { generateWithFallback } from "./router";
import { guardProvider } from "./request-control";

/** One explicitly selected provider per request. Never silently switch provider. */
export function getAiProvider(model: string = "gemini"): AiProvider | null {
  let candidate: AiProvider | null = null;
  if (model === "gemini" && process.env.GEMINI_API_KEY) {
    candidate = createGeminiProvider(process.env.GEMINI_API_KEY, "gemini");
  } else if (model === "cloudflare" && process.env.AI_ENABLE_CLOUDFLARE_FREE === "true") {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const apiToken = process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN ?? "";
    candidate = createCloudflareProvider({ accountId, apiToken }, true);
  } else if (model === "groq" && process.env.AI_ENABLE_GROQ_FREE === "true" && process.env.GROQ_API_KEY) {
    candidate = createGroqProvider(process.env.GROQ_API_KEY, true);
  }
  else if (model === "mistral" && process.env.AI_ENABLE_MISTRAL_FREE === "true" && process.env.MISTRAL_FREE_PLAN_CONFIRMED === "true" && process.env.MISTRAL_API_KEY) {
    candidate = createMistralProvider(process.env.MISTRAL_API_KEY, true);
  }
  if (!candidate?.enabled || !candidate.available) return null;
  const provider = guardProvider(candidate);
  return { ...provider, generate: request => generateWithFallback([provider], request) };
}
