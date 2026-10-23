import { NextResponse } from "next/server";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { getAiModelStatuses } from "@/lib/ai/model-status";

/** Does not expose keys, provider balances, or user identifiers. */
export async function GET() {
  const denied = await requireFoodApiAuth();
  if (denied) return denied;
  return NextResponse.json({ models: await getAiModelStatuses() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
