import type { FoodAnalysis } from "@/lib/food-analysis";

/** Severe mismatch between AI-reported meal total and its item calories.
 * A wide rounding margin avoids rejecting ordinary label differences.
 * This does not recalculate or guess nutrition and never uses nutrition macros
 * to overwrite model output. The server can normalize minor rounding only.
 */
export function hasSevereAiTotalCalorieMismatch(
  result: Pick<FoodAnalysis, "foods" | "totalCalories">,
): boolean {
  if (result.foods.length === 0) return false;
  const expected = result.foods.reduce((total, item) => total + item.calories, 0);
  const reported = result.totalCalories;
  if (!Number.isFinite(expected) || !Number.isFinite(reported) || expected < 0 || reported < 0) return false;
  const difference = Math.abs(expected - reported);
  return difference > Math.max(25, 0.15 * Math.max(expected, reported));
}