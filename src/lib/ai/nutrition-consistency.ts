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

/** Block only EXTREME contradictions from lightweight photo providers.
 * 4/4/9 is an approximation, not a universal calorie formula: alcohol, fibre,
 * rounding and label differences can legitimately shift the total.
 * This is a plausibility gate, NEVER an automatic macro recalculation. */
export function hasSevereCalorieMacroMismatch(food: FoodItem): boolean {
  if (food.unknownMacros?.length) return false;
  const { calories, protein, carbs, fat } = food;
  if (![calories, protein, carbs, fat].every(value => Number.isFinite(value) && value >= 0)) return false;
  // Alcohol's energy (about 7 kcal/g) is omitted from standard P/C/F fields.
  // Don't reject visibly alcoholic drinks solely for this reason.
  if (/\b(beer|wine|vodka|whisky|whiskey|rum|gin|tequila|liqueur|liquor|cocktail|alcohol|hard seltzer)\b/i.test(food.name)) return false;
  const macroCalories = 4 * protein + 4 * carbs + 9 * fat;
  const largerTotal = Math.max(calories, macroCalories);
  if (largerTotal < 100) return false;
  const difference = Math.abs(calories - macroCalories);
  return difference >= 80 && difference / largerTotal >= 0.5;
}
