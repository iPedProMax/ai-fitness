import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import { createMistralProvider } from "./providers/mistral";
import { createOllamaLocalProvider } from "./providers/ollama-local";
import { createFreeTextProvider } from "./providers/free-text";
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
  else if (model === "ollama-local" && process.env.NODE_ENV !== "production" && process.env.AI_ENABLE_OLLAMA_LOCAL === "true") {
    candidate = createOllamaLocalProvider(true);
  }
  else if (model === "openrouter" && process.env.AI_ENABLE_OPENROUTER_FREE === "true" && process.env.OPENROUTER_FREE_ONLY_CONFIRMED === "true" && process.env.OPENROUTER_API_KEY) {
    candidate = createFreeTextProvider("openrouter", process.env.OPENROUTER_API_KEY, true);
  } else if (model === "zai" && process.env.AI_ENABLE_ZAI_FREE === "true" && process.env.ZAI_ZERO_SPEND_CONFIRMED === "true" && process.env.ZAI_API_KEY) {
    candidate = createFreeTextProvider("zai", process.env.ZAI_API_KEY, true);
  } else if (model === "siliconflow" && process.env.AI_ENABLE_SILICONFLOW_FREE === "true" && process.env.SILICONFLOW_ZERO_SPEND_CONFIRMED === "true" && process.env.SILICONFLOW_API_KEY) {
    candidate = createFreeTextProvider("siliconflow", process.env.SILICONFLOW_API_KEY, true);
  } else if (model === "huggingface" && process.env.AI_ENABLE_HUGGINGFACE_FREE === "true" && process.env.HUGGINGFACE_ZERO_SPEND_CONFIRMED === "true" && process.env.HF_TOKEN) {
    candidate = createFreeTextProvider("huggingface", process.env.HF_TOKEN, true);
  } else if (model === "cerebras" && process.env.AI_ENABLE_CEREBRAS_FREE === "true" && process.env.CEREBRAS_FREE_PLAN_CONFIRMED === "true" && process.env.CEREBRAS_API_KEY) {
    candidate = createFreeTextProvider("cerebras", process.env.CEREBRAS_API_KEY, true);
  }
  if (!candidate?.enabled || !candidate.available) return null;
  const provider = guardProvider(candidate);
  return { ...provider, generate: request => generateWithFallback([provider], request) };
}
