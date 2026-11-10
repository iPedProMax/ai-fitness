import type { AiModelId } from "./model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

/** Strict, disjoint provider rosters. Authorization and billing checks are separate. */
export const VISION_AI_PROVIDERS: readonly AiModelId[] = [
  // Quality-first production photo roster. Evaluate other vision-capable adapters
  // separately before offering them in food-photo logging.
  "gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision",
];
export type ProviderRole = "vision" | "text";
export function isProviderAllowedForRole(id: string, role: ProviderRole): boolean {
  return (role === "vision" ? VISION_AI_PROVIDERS : SHARED_TEXT_AI_PROVIDERS)
    .some(model => model === id);
}