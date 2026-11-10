import type { FoodAnalysis } from "./food-analysis";
import type { ManualFoodInput } from "./manual-food";

/** Copy a model's own score only when the displayed row still matches its numbers.
 * Model confidence is a self-report, NOT a calibrated accuracy percentage. */
export function matchAiReportedConfidence(
  rows: ManualFoodInput[],
  suggestions: FoodAnalysis["foods"],
): (number | null)[] {
  const used = new Set<number>();
  return rows.map(row => {
    const index = suggestions.findIndex((food, i) => !used.has(i) &&
      food.name.trim().toLowerCase() === row.name.trim().toLowerCase() &&
      ([
        [row.grams, food.estimatedGrams],
        [row.calories, food.calories],
        [row.protein, food.protein],
        [row.carbs, food.carbs],
        [row.fat, food.fat],
      ] as [string, number][]).every(([value, expected]) =>
        value.trim() !== "" && Number.isFinite(Number(value)) &&
        Math.abs(Number(value) - expected) <= 0.011));
    if (index < 0) return null;
    used.add(index);
    const score = suggestions[index].confidence;
    return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1
      ? score : null;
  });
}