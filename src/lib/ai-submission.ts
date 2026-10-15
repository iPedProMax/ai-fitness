/** A logical submission keeps one key across a network retry. Callers can retain
 * the key explicitly for a later retry; deliberate new submissions use new keys. */
export type AiSubmissionOptions = { idempotencyKey?: string };
export async function submitAiRequest(url: string, init: RequestInit, options: AiSubmissionOptions = {}) {
  const key = options.idempotencyKey ?? crypto.randomUUID();
  const headers = new Headers(init.headers);
  headers.set("Idempotency-Key", key);
  const request = { ...init, headers };
  // Retry only transport errors. Never retry an HTTP error or buy another credit.
  try { return await fetch(url, request); }
  catch (error) {
    if (!(error instanceof TypeError) || init.signal?.aborted) throw error;
    return fetch(url, request);
  }
}
