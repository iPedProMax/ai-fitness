/** A logical submission keeps one key across a network retry. Callers can retain
 * the key explicitly for a later retry; deliberate new submissions use new keys. */
import type { AiModelId } from "./ai/model-catalog";
export type AiSubmissionOptions = { idempotencyKey?: string; modelId?: AiModelId };
export class AiHttpError extends Error {
  constructor(message: string, readonly code?: string, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "AiHttpError";
  }
}
/** Only a server-provided HTTP Retry-After authorizes an exact cooldown. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const raw = header.trim();
  const seconds = /^\d+$/.test(raw)
    ? Number(raw)
    : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400
    ? seconds : undefined;
}

export function foodApiError(payload: { error?: string; code?: string }, fallback: string, retryAfter: string | null = null) {
  const wait = payload.code === "AI_PROVIDER_LIMITED" ? parseRetryAfter(retryAfter) : undefined;
  return new AiHttpError(payload.error || fallback, payload.code, wait);
}
export async function submitAiRequest(url: string, init: RequestInit, options: AiSubmissionOptions = {}) {
  const key = options.idempotencyKey ?? crypto.randomUUID();
  const headers = new Headers(init.headers);
  headers.set("Idempotency-Key", key);
  const request = { ...init, headers };
  // Retry only transport errors. Never retry an HTTP error or buy another credit.
  // Reflect the durable server balance even when the meal is never saved.
  try {
    try { return await fetch(url, request); }
    catch (error) {
      if (!(error instanceof TypeError) || init.signal?.aborted) throw error;
      return await fetch(url, request);
    }
  } finally {
    // A failed request may have consumed an upstream attempt. Never guess whether
    // a credit was used: tell the visible balance to re-read the server.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("khalories:ai-usage-changed"));
    }
  }
}
