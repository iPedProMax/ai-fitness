import "server-only";

import { AiRoutingError, isTransientProviderFailure } from "./errors";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./types";

export type RoutingOptions = {
  maxAttempts?: number;
  attemptTimeoutMs?: number;
  totalTimeoutMs?: number;
};

const limits = { maxAttempts: 2, attemptTimeoutMs: 50_000, totalTimeoutMs: 60_000 };

export function selectCompatibleProviders(
  providers: readonly AiProvider[], request: AiGenerationRequest,
): AiProvider[] {
  const images = request.input.filter(part => part.type === "image").length;
  const seen = new Set<string>();
  return [...providers]
    .sort((a, b) => Number(b.id === "gemini") - Number(a.id === "gemini"))
    .filter(provider => {
      const capabilities = provider.capabilities;
      if (!provider.enabled || !provider.available || !capabilities.text || !capabilities.structuredJson ||
        !Number.isInteger(capabilities.maxImages) || capabilities.maxImages < 0 ||
        (images > 0 && (!capabilities.vision || images > capabilities.maxImages)) || seen.has(provider.id)) return false;
      seen.add(provider.id);
      return true;
    });
}

function callWithDeadline(provider: AiProvider, request: AiGenerationRequest, timeoutMs: number) {
  return new Promise<AiGenerationResult>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", cancel);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = () => {
      fail(new AiRoutingError("CANCELLED"));
      controller.abort();
    };
    const timer = setTimeout(() => {
      fail(new AiRoutingError("TIMEOUT"));
      controller.abort();
    }, timeoutMs);
    request.signal?.addEventListener("abort", cancel, { once: true });
    if (request.signal?.aborted) { cancel(); return; }

    // Keep rejection handlers attached even if a provider ignores cancellation.
    try {
      Promise.resolve(provider.generate({ ...request, signal: controller.signal })).then(result => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      }, fail);
    } catch (error) { fail(error); }
  });
}

/** No Supabase calls or credit accounting belong inside this attempt loop. */
export async function generateWithFallback(
  providers: readonly AiProvider[], request: AiGenerationRequest, options: RoutingOptions = {},
): Promise<AiGenerationResult> {
  const policy = { ...limits, ...options };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    if (!Number.isInteger(policy[key]) || policy[key] <= 0 || policy[key] > limits[key]) {
      throw new RangeError(`Invalid AI routing setting: ${key}`);
    }
  }
  if (request.signal?.aborted) throw new AiRoutingError("CANCELLED");
  const candidates = selectCompatibleProviders(providers, request).slice(0, policy.maxAttempts);
  if (candidates.length === 0) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  const deadline = Date.now() + policy.totalTimeoutMs;
  for (const provider of candidates) {
    if (request.signal?.aborted) throw new AiRoutingError("CANCELLED");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AiRoutingError("TIMEOUT");
    try {
      return await callWithDeadline(provider, request, Math.min(policy.attemptTimeoutMs, remaining));
    } catch (error) {
      if (!isTransientProviderFailure(error)) throw error;
      if (provider === candidates[candidates.length - 1]) {
        throw error instanceof AiRoutingError ? error : new AiRoutingError("UNAVAILABLE");
      }
    }
  }
  throw new AiRoutingError("UNAVAILABLE");
}
