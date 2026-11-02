import type { AiModelId } from "./model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

/** Strict, disjoint provider rosters. Authorization and billing checks are separate. */
export const VISION_AI_PROVIDERS: readonly AiModelId[] = [
  "gemini", "groq", "cloudflare", "zai", "openrouter",
];
export type ProviderRole = "vision" | "text";
export function isProviderAllowedForRole(id: string, role: ProviderRole): boolean {
  return (role === "vision" ? VISION_AI_PROVIDERS : SHARED_TEXT_AI_PROVIDERS)
    .some(model => model === id);
}