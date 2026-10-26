import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAiModelId, type AiModelId } from "./model-catalog";

const policySchema = z.array(z.object({
  id: z.string(),
  enabled: z.boolean(),
  reason: z.string().nullable(),
}));
export type FreeGeminiPolicy = { enabled: boolean; reason: string | null };

/** Server-only read-only RPC. Failure closes extra models, never guesses Google balances. */
export async function readFreeGeminiPolicies(): Promise<Map<AiModelId, FreeGeminiPolicy>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const output = new Map<AiModelId, FreeGeminiPolicy>();
  if (!url || !key) return output;
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init, signal: AbortSignal.timeout(5_000), redirect: "error",
      }) },
    });
    const { data, error } = await client.rpc("list_free_gemini_models");
    if (error) return output;
    for (const item of policySchema.parse(data)) {
      if (isAiModelId(item.id)) output.set(item.id, { enabled: item.enabled, reason: item.reason });
    }
  } catch { /* No unsafe optimistic enablement on database errors. */ }
  return output;
}
