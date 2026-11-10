import type { FoodAnalysis } from "@/lib/food-analysis";

/**
 * A deliberately narrow deterministic refinement path. Never infer ingredient
 * quantities or recalculate nutrition from a brand/variety name.
 */
export function resolveLocalClarification(
  analysis: FoodAnalysis,
  clarificationId: string,
  answer: string,
): FoodAnalysis | null {
  const match = /^(brand|variety)_(\d+)$/.exec(clarificationId);
  if (!match) return null;
  const kind = match[1] as "brand" | "variety";
  const foodIndex = Number(match[2]);
  const question = analysis.clarifications.find(
    item => item.id === clarificationId && item.foodIndex === foodIndex,
  );
  const food = analysis.foods[foodIndex];
  if (!question || !food) return null;

  const value = answer.trim();
  const unknown = /^(?:i don['â€™]t know|don't know|not sure|unknown|unsure)$/i.test(value);
  const unresolved = /\b(?:maybe|probably|possibly|not sure|unsure|unknown|i think)\b/i.test(value);
  const numeric = /\d/.test(value);
  const meaningfulChange = /\b(?:added?|extra|with|without|sugar|sweetened|syrup|milk|oil|butter|honey|sauce|cream|grams?|kcal|calories|servings?|tablespoons?|teaspoons?|cups?|ml)\b/i.test(value);

  // These answers only dismiss an optional question; keep original nutrition.
  if (unknown) {
    return {
      ...analysis,
      clarifications: analysis.clarifications.filter(item => item.id !== clarificationId),
    };
  }

  // A product name alone cannot justify adjusting calories. Accept a clear
  // brand as metadata while explicitly preserving the visual/label estimate.
  if (kind === "brand" && !unresolved && !numeric && !meaningfulChange &&
      /^[\p{L}][\p{L} .&'â€™-]{1,59}$/u.test(value)) {
    const foods = analysis.foods.map((item, index) =>
      index === foodIndex ? { ...item, brandStatus: "KNOWN" as const } : item,
    );
    return {
      ...analysis,
      foods,
      clarifications: analysis.clarifications.filter(item => item.id !== clarificationId),
      notes: `${analysis.notes.trim()} User identified the brand as ${value}; nutrition was not recalculated from the brand name alone.`.trim(),
    };
  }

  // Explicitly matching an already-identified variety is non-nutritional.
  // A DIFFERENT variety (e.g. white vs brown rice) requires re-analysis.
  if (kind === "variety" && !unresolved && !numeric && !meaningfulChange &&
      value.length >= 3 && food.name.toLocaleLowerCase().includes(value.toLocaleLowerCase())) {
    return {
      ...analysis,
      foods: analysis.foods.map((item, index) =>
        index === foodIndex ? { ...item, varietyStatus: "KNOWN" as const } : item,
      ),
      clarifications: analysis.clarifications.filter(item => item.id !== clarificationId),
    };
  }

  return null; // Keep nutritionally material or ambiguous cases on the AI path.
}
