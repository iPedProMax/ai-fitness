import type { FoodAnalysis } from "@/lib/food-analysis";

/** Used ONLY for Groq and Cloudflare. Gemini's multi-food behavior is unchanged. */
export function normalizeSingleFoodProvider(analysis: FoodAnalysis): FoodAnalysis {
  if (analysis.foods.length !== 1) {
    // Never save a silently truncated multi-food response.
    throw new Error("Expected exactly one food or drink from single-item provider");
  }
  // Total is a derived value. Do not trust a conflicting model-generated total.
  return { ...analysis, totalCalories: analysis.foods[0].calories };
}