import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const resultSchema = z.union([
  z.object({ claim: z.uuid() }),
  z.object({ ok: z.literal(true) }),
  z.object({ replay: z.literal(true), status: z.number().int().min(200).max(599), body: z.unknown() }),
  z.object({ code: z.string().regex(/^AI_[A-Z_]+$/), status: z.number().int().min(400).max(599),
    remaining: z.number().optional(), resetsAt: z.string().optional(), retryAfter: z.number().int().positive().optional() }),
]);
export type ControlResult = z.infer<typeof resultSchema>;
export type ControlArguments = {
  p_operation: "begin" | "attempt" | "finish" | "settle";
  p_user_id: string; p_key: string; p_hash?: string;
  p_kind?: "analysis" | "refinement"; p_claim?: string;
  p_provider?: string; p_tokens?: number; p_status?: number; p_body?: unknown;
};

/** Separate trusted client: never use this for ordinary application data access. */
export async function controlRequest(args: ControlArguments): Promise<ControlResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("AI accounting is not configured");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, signal: AbortSignal.timeout(5_000), redirect: "error",
    }) },
  });
  const { data, error } = await client.rpc("control_ai_request", args);
  if (error) throw new Error("AI accounting unavailable");
  return resultSchema.parse(data);
}
