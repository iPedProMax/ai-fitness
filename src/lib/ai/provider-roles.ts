import type { AiModelId } from "./model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";
/** Purpose-first routing. Display recommendations only; server authorization is separate. */
export type AiRole = "photo" | "manual" | "coach" | "refinement";
export const BEST_FOR_PHOTOS: readonly AiModelId[] = ["gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision"];
export const TEXT_SPECIALISTS: readonly AiModelId[] = ["openrouter", "zai", "siliconflow", "huggingface", "cerebras"];
export function recommendedProviders(role: AiRole): readonly AiModelId[] {
  return role === "photo" ? BEST_FOR_PHOTOS : SHARED_TEXT_AI_PROVIDERS;
}