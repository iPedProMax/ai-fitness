import type { FoodAnalysis } from "@/lib/food-analysis";

type FoodItem = FoodAnalysis["foods"][number];

/** A non-blocking signal, not a recalculation. Labels can include fibre,
 * rounding or nutrients that aren't captured by a simple 4/4/9 estimate. */
export function hasMaterialCalorieMacroMismatch(food: FoodItem): boolean {
  if (food.unknownMacros?.length) return false;
  if (![food.calories, food.protein, food.carbs, food.fat].every(Number.isFinite)) return false;
  if (food.calories < 25) return false;

  const macroCalories = 4 * food.protein + 4 * food.carbs + 9 * food.fat;
  const discrepancy = Math.abs(food.calories - macroCalories);
  return discrepancy > Math.max(15, food.calories * 0.25);
}
