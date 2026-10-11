import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AiUsageStatus = {
  limit: number;
  used: number;
  remaining: number;
  refinementLimit: number;
  refinementsUsed: number;
  resetsAt: string;
};

type AiReservation = {
  allowed: boolean;
  kind: "analysis" | "refinement";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
};

const noStore = { "Cache-Control": "private, no-store" };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReservation(value: unknown): value is AiReservation {
  return isObject(value) &&
    typeof value.allowed === "boolean" &&
    (value.kind === "analysis" || value.kind === "refinement") &&
    isCount(value.limit) && isCount(value.used) && isCount(value.remaining) &&
    typeof value.resetsAt === "string" && !Number.isNaN(Date.parse(value.resetsAt));
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

/** Atomically charges one allowed request, before Gemini is called. */
export async function reserveAiUsage(kind: "analysis" | "refinement"): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reserve_ai_usage", { p_kind: kind });
    if (error || !isReservation(data) || data.kind !== kind) return unavailable();
    if (!data.allowed) {
      return NextResponse.json({
        error: kind === "analysis"
          ? "Your 20 free AI analyses are used up for today. You can still log food manually."
          : "Your daily AI clarification limit has been reached. Try again tomorrow.",
        code: "AI_QUOTA_EXCEEDED",
        remaining: data.remaining,
        resetsAt: data.resetsAt,
      }, { status: 429, headers: noStore });
    }
    return null;
  } catch {
    return unavailable();
  }
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