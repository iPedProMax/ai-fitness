import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { controlRequest, type ControlResult } from "./control-store";
import { AiRoutingError } from "./errors";
import { geminiTokenReservation } from "./gemini-token-budget";
import { isGeminiModelId } from "./model-catalog";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./types";

type Context = { request: Request; snapshot: Request; userId?: string; key?: string; claim?: string };
const contexts = new AsyncLocalStorage<Context>();
const noStore = { "Cache-Control": "private, no-store" };
const unavailable = () => NextResponse.json({ error: "AI accounting is temporarily unavailable.", code: "AI_ACCOUNTING_UNAVAILABLE" }, { status: 503, headers: noStore });
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Hash only; no photos, descriptions, or prompts are stored in request records. */
export async function fingerprintRequest(request: Request): Promise<string> {
  let payload: unknown;
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const entries: unknown[] = [];
    for (const [name, value] of await request.formData()) {
      entries.push(typeof value === "string" ? [name, value] :
        [name, value.name, value.type, hash(new Uint8Array(await value.arrayBuffer()))]);
    }
    payload = entries;
  } else {
    payload = await request.json();
  }
  return hash(canonical([request.method, new URL(request.url).pathname, payload]));
}

function controlResponse(result: ControlResult): NextResponse {
  if ("replay" in result) {
    return NextResponse.json(result.body, { status: result.status, headers: { ...noStore, "Idempotency-Replayed": "true" } });
  }
  if ("code" in result) {
    const error = result.code === "AI_QUOTA_EXCEEDED"
      ? "Your daily AI allowance has been reached. Manual logging is still free."
      : result.code === "AI_KEY_CONFLICT" ? "This request key was already used with a different payload."
      : result.code === "AI_REQUEST_IN_PROGRESS" ? "This AI request is still processing. Retry with the same key."
      : "This AI request cannot run safely. Keep the request key when checking its result.";
    return NextResponse.json({ error, ...result }, { status: result.status, headers: noStore });
  }
  return unavailable();
}

/** Invoked at the existing credit reservation point, after route validation. */
export async function reserveDurableAiUsage(kind: "analysis" | "refinement"): Promise<NextResponse | null> {
  const context = contexts.getStore();
  if (!context || context.claim) return unavailable();
  if (process.env.AI_ENABLED !== "true") {
    return NextResponse.json({ error: "AI analysis is currently disabled.", code: "AI_DISABLED" }, { status: 503, headers: noStore });
  }
  try {
    // Never derive identity from request headers, JSON, or a service-role JWT.
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return unavailable();
    const key = context.request.headers.get("Idempotency-Key") ?? randomUUID();
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
      return NextResponse.json({ error: "Invalid Idempotency-Key.", code: "AI_INVALID_KEY" }, { status: 400, headers: noStore });
    }
    const result = await controlRequest({ p_operation: "begin", p_user_id: data.user.id,
      p_key: key, p_hash: await fingerprintRequest(context.snapshot), p_kind: kind });
    if (!("claim" in result)) return controlResponse(result);
    context.userId = data.user.id;
    context.key = key;
    context.claim = result.claim;
    return null;
  } catch { return unavailable(); }
}

/** Capture the FINAL validated/normalized public response for exact replay. */
export async function withAiRequest(request: Request, handler: () => Promise<Response>): Promise<Response> {
  const context: Context = { request, snapshot: request.clone() };
  return contexts.run(context, async () => {
    let response: Response;
    try { response = await handler(); }
    catch { response = unavailable(); }
    if (!context.claim || !context.userId || !context.key) return response;
    try {
      const result = await controlRequest({ p_operation: "finish", p_user_id: context.userId,
        p_key: context.key, p_claim: context.claim, p_status: response.status,
        p_body: await response.clone().json() });
      if (!("ok" in result)) return unavailable();
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Idempotency-Key", context.key);
      return response;
    } catch { return unavailable(); }
  });
}

// Groq remains disabled/unregistered and retains its original full-model bound.
// Every reservation remains consumed on errors/timeouts; no optimistic refunds.
const tokenCeilings: Record<string, number> = { groq: 131_072 + 65_536 };

async function observeCancellation(provider: AiProvider, request: AiGenerationRequest) {
  let cancel = () => {};
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(new AiRoutingError("TIMEOUT"));
    request.signal?.addEventListener("abort", cancel, { once: true });
  });
  try {
    if (request.signal?.aborted) throw new AiRoutingError("CANCELLED");
    // A provider that ignores abort must not prevent durable timeout settlement.
    return await Promise.race([provider.generate(request), aborted]);
  } finally { request.signal?.removeEventListener("abort", cancel); }
}

export function guardProvider(provider: AiProvider): AiProvider {
  return { ...provider, generate: async request => {
    const context = contexts.getStore();
    if (!context?.claim || !context.userId || !context.key || process.env.AI_ENABLED !== "true") {
      throw new AiRoutingError("ACCOUNTING_UNAVAILABLE");
    }
    try {
      const tokens = isGeminiModelId(provider.id) ? geminiTokenReservation(request) : tokenCeilings[provider.id];
      if (!tokens) throw new Error("Unaccounted model");
      const result = await controlRequest({ p_operation: "attempt", p_user_id: context.userId,
        p_key: context.key, p_claim: context.claim, p_provider: provider.id, p_tokens: tokens });
      if (!("ok" in result)) {
        if ("code" in result && ["AI_PROVIDER_COOLDOWN", "AI_PROVIDER_CONCURRENCY", "AI_GLOBAL_LIMIT"].includes(result.code)) {
          throw new AiRoutingError("PROVIDER_LIMITED", result.retryAfter ?? 30);
        }
        throw new Error("Attempt denied");
      }
    } catch (error) {
      if (error instanceof AiRoutingError) throw error;
      throw new AiRoutingError("ACCOUNTING_UNAVAILABLE");
    }
    let status = 200;
    let output: AiGenerationResult | undefined;
    let failed = false;
    let providerError: unknown;
    try {
      output = await observeCancellation(provider, request);
    } catch (error) {
      failed = true;
      providerError = error;
      status = error instanceof AiRoutingError ? (error.code === "TIMEOUT" ? 504 : 499)
        : error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status
        : error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 520;
      if (request.signal?.aborted) status = 504;
      // Safe diagnostics only: never log model prompts, image data, API keys, or raw SDK errors.
      if (process.env.NODE_ENV !== "test") {
        const upstreamStatus = error && typeof error === "object"
          ? ("status" in error && typeof error.status === "number" ? error.status
            : "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : null)
          : null;
        const typeName = error instanceof AiRoutingError ? error.code
          : error && typeof error === "object" && "name" in error &&
            typeof error.name === "string" &&
            ["APIError", "ConnectionError", "RequestTimeoutError", "APIConnectionError", "APIConnectionTimeoutError", "AbortError"].includes(error.name)
            ? error.name : "Other";
        // Next.js's development log can serialize separate object arguments as {}.
        // Emit one JSON-formatted STRING containing only allowlisted, non-sensitive fields.
        console.warn("[AI_PROVIDER_DIAGNOSTIC] " + JSON.stringify({
          model: provider.id,
          upstreamStatus,
          settlementStatus: status,
          errorType: typeName,
          aborted: request.signal?.aborted === true,
        }));
      }
    }
    try {
      const result = await controlRequest({ p_operation: "settle", p_user_id: context.userId,
        p_key: context.key, p_claim: context.claim, p_provider: provider.id, p_status: status });
      if (!("ok" in result)) throw new Error("Settlement denied");
    } catch { throw new AiRoutingError("ACCOUNTING_UNAVAILABLE"); }
    if (failed) throw providerError;
    return output!;
  } };
}
