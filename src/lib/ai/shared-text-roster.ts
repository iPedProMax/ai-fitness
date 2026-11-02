import type { AiModelId } from "./model-catalog";

/** Manual AI estimates and AURA share exactly this text-only roster.
 * Vision models are deliberately excluded. Availability is independently
 * checked by the authenticated server; no paid or cross-roster fallback.
 */
export const SHARED_TEXT_AI_PROVIDERS: readonly AiModelId[] = [
  "cerebras", "siliconflow", "huggingface", "mistral", "ollama-local",
];