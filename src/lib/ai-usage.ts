import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reserveDurableAiUsage } from "@/lib/ai/request-control";

export type AiUsageStatus = {
  limit: number;
  used: number;
  remaining: number;
  refinementLimit: number;
  refinementsUsed: number;
  resetsAt: string;
};

const noStore = { "Cache-Control": "private, no-store" };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUsage(value: unknown): value is AiUsageStatus {
  return isObject(value) &&
    isCount(value.limit) && isCount(value.used) && isCount(value.remaining) &&
    isCount(value.refinementLimit) && isCount(value.refinementsUsed) &&
    typeof value.resetsAt === "string" && !Number.isNaN(Date.parse(value.resetsAt));
}

function unavailable(): NextResponse {
  // Do not allow Gemini calls if Supabase is unavailable or the RPC is missing.
  return NextResponse.json(
    { error: "AI usage tracking is temporarily unavailable. Please try again." },
    { status: 503, headers: noStore }
  );
}

/** Atomically admits one logical request within its durable HTTP context. */
export async function reserveAiUsage(kind: "analysis" | "refinement"): Promise<NextResponse | null> {
  return reserveDurableAiUsage(kind);
}

/** Read-only status. Must be called behind requireFoodApiAuth(). */
export async function getAiUsage(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_ai_usage");
    if (error || !isUsage(data)) return unavailable();
    return NextResponse.json(data, { headers: noStore });
  } catch {
    return unavailable();
  }
}
