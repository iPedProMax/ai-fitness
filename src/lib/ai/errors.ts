import "server-only";

import { NextResponse } from "next/server";

type RoutingErrorCode = "NO_COMPATIBLE_PROVIDER" | "UNAVAILABLE" | "TIMEOUT" | "CANCELLED" | "ACCOUNTING_UNAVAILABLE" | "PROVIDER_LIMITED" | "INPUT_TOO_LARGE";

const messages: Record<RoutingErrorCode, string> = {
  INPUT_TOO_LARGE: "This request exceeds the selected AI provider's safe size or token limit. Try fewer photos or switch to Gemini.",
  PROVIDER_LIMITED: "The selected AI provider is rate-limited or at capacity. Wait for its cooldown before trying again.",
  ACCOUNTING_UNAVAILABLE: "AI usage accounting cannot safely authorize this request.",
  NO_COMPATIBLE_PROVIDER: "No compatible AI provider is available for this request.",
  UNAVAILABLE: "AI providers are temporarily unavailable. Please try again later.",
  TIMEOUT: "The selected AI provider timed out before finishing the scan. You can try one clear photo later; a new attempt may count as an analysis.",
  CANCELLED: "The AI request was cancelled.",
};

export class AiRoutingError extends Error {
  constructor(readonly code: RoutingErrorCode, readonly retryAfterSeconds?: number) {
    super(messages[code]);
    this.name = "AiRoutingError";
  }
}

/** Conservative allowlist: unknown errors are never assumed transient. */
export function isTransientProviderFailure(error: unknown): boolean {
  if (error instanceof AiRoutingError) return error.code === "TIMEOUT" || error.code === "PROVIDER_LIMITED";
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "AI_QUOTA_EXCEEDED") return false;
  if ("name" in error && ["AbortError", "ZodError"].includes(String(error.name))) return false;
  const status = "status" in error && typeof error.status === "number"
    ? error.status : "statusCode" in error ? error.statusCode : undefined;
  if (typeof status === "number") return [408, 429, 500, 502, 503, 504].includes(status);
  if ("name" in error && error.name === "APIConnectionError") {
    // The SDK also uses this wrapper for invalid/unknown client errors.
    const cause = "cause" in error ? error.cause : undefined;
    return !!cause && typeof cause === "object" && "name" in cause && cause.name === "ConnectionError";
  }
  // Interactions SDK network/timeout classes have no HTTP status.
  return "name" in error && ["ConnectionError", "RequestTimeoutError", "APIConnectionTimeoutError"].includes(String(error.name));
}

/** Only sanitized router errors become public; existing route errors stay intact. */
export function aiRoutingErrorResponse(error: unknown): NextResponse | null {
  // A provider's explicit HTTP 429 is a known capacity/rate-limit response,
  // never a signal to silently choose another model.
  if (!(error instanceof AiRoutingError)) {
    const status = error && typeof error === "object" && "status" in error ? error.status :
      error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
    if (status === 429) return aiRoutingErrorResponse(new AiRoutingError("PROVIDER_LIMITED"));
    // Distinguish explicit upstream timeouts from generic service failures.
    // Never inspect provider message text: SDK error text may include private data.
    const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
    if (status === 408 || status === 504 ||
        name === "RequestTimeoutError" || name === "APIConnectionTimeoutError" || name === "TimeoutError") {
      return aiRoutingErrorResponse(new AiRoutingError("TIMEOUT"));
    }
    return null;
  }
  const status = error.code === "INPUT_TOO_LARGE" ? 413 : error.code === "TIMEOUT" ? 504 : error.code === "CANCELLED" ? 408 : 503;
  return NextResponse.json({ error: error.message, code: `AI_${error.code}` }, {
    status, headers: { "Cache-Control": "private, no-store", ...(error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}) },
  });
}
