import type { AiModelStatus } from "./model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

/** UI hint only: the backend always reauthorizes on every request. */
export function isTextAiReady(statuses: readonly AiModelStatus[] | null, id: string): boolean {
  return statuses?.some(status =>
    status.id === id && status.enabled === true && status.text === true &&
    SHARED_TEXT_AI_PROVIDERS.includes(status.id)
  ) ?? false;
}

/** Do not infer availability from a configured key or from a missing/401 response. */
export function readyTextAiIds(statuses: readonly AiModelStatus[] | null): string[] {
  return SHARED_TEXT_AI_PROVIDERS.filter(id => isTextAiReady(statuses, id));
}