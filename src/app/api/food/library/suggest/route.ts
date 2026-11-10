import "server-only";
import { NextResponse } from "next/server";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { normalizeSmartFoodQuery } from "@/lib/food-smart-query";
import { suggestReviewedFoods } from "@/lib/food-smart-catalog";
import { findPhCommunityFood } from "@/lib/ph-community-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const head = { "Cache-Control": "private, no-store" };

/** Live suggestions query only the published Khalories library, never Open Food Facts. */
export async function GET(request: Request) {
  const blocked = await requireFoodApiAuth();
  if (blocked) return blocked;
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = normalizeSmartFoodQuery(raw);
  if (raw.length > 60 || query.length < 3) return NextResponse.json({ foods: [], communityFoods: [], source: "Khalories Philippine Food Library" }, { headers: head });
  const foods = await suggestReviewedFoods(query);
  // Offline PH-tagged community suggestions are unverified and kept separate from reviewed rows.
  // Local lookup has no external API call and uses no AI credits.
  const communityFoods = findPhCommunityFood("search", query)
    .filter(food => !foods.some(reviewed => reviewed.barcode === food.barcode));
  return NextResponse.json({ foods, communityFoods, source: "Khalories Philippine Food Library" }, { headers: head });
}
