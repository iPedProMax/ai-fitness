import type { AiModelId } from "./model-catalog";
/** Purpose-first routing. Display recommendations only; server authorization is separate. */
export type AiRole = "photo" | "manual" | "coach" | "refinement";
export const BEST_FOR_PHOTOS: readonly AiModelId[] = ["gemini", "groq"];
export const TEXT_SPECIALISTS: readonly AiModelId[] = ["openrouter", "zai", "siliconflow", "huggingface", "cerebras"];
export function recommendedProviders(role: AiRole): readonly AiModelId[] {
  return role === "photo" ? BEST_FOR_PHOTOS :
    role === "coach" ? ["ollama-local", "openrouter", "cerebras", "groq", "cloudflare", "gemini", "zai", "siliconflow", "huggingface", "mistral"] :
    ["gemini", "groq", "ollama-local", "openrouter", "cloudflare", "cerebras", "zai", "siliconflow", "huggingface", "mistral"];
}