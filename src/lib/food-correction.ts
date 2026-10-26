import { foodAnalysisSchema, type FoodAnalysis } from "./food-analysis";

type Food = FoodAnalysis["foods"][number];
export type FoodCorrection = Pick<Food, "name"> & Partial<Pick<Food, "estimatedGrams" | "calories" | "protein" | "carbs" | "fat">>;

const nutritionFields = ["calories", "protein", "carbs", "fat"] as const;

/** Replaces stale model prose after a local correction. No model call is made. */
function correctionNotes(
  foods: FoodAnalysis["foods"],
  foodIndex: number,
  correction: FoodCorrection
): string {
  const food = foods[foodIndex];
  const editedNutrition = nutritionFields.filter(field => correction[field] !== undefined);
  const keptNutrition = nutritionFields.filter(field => correction[field] === undefined);
  const pieces = [
    `User confirmed the food as ${food.name}.`,
    "Earlier AI notes were cleared because they may describe the wrong food.",
  ];
  if (correction.estimatedGrams !== undefined) {
    pieces.push(`User entered a serving weight of ${food.estimatedGrams} g; this is not automatically a verified scale measurement.`);
  } else {
    pieces.push(`Serving weight remains the previous ${food.estimatedGrams} g estimate unless independently verified.`);
  }
  if (editedNutrition.length) {
    pieces.push(`User supplied these nutrition values: ${editedNutrition.join(", ")}.`);
  }
  if (keptNutrition.length) {
    pieces.push(`Unchanged ${keptNutrition.join(", ")} still come from the prior estimate; they were not recalculated for the corrected food.`);
  } else {
    pieces.push("All displayed nutrition values were supplied by the user; they have not been independently verified.");
  }
  if (foods.length > 1) {
    pieces.push("Other food items keep their existing estimates. Their original AI explanations may not be retained in this summary.");
  }
  return pieces.join(" ");
}

/** Local user edit. Never triggers an AI call, rescales macros, or changes another item. */
export function applyFoodCorrection(
  analysis: FoodAnalysis,
  foodIndex: number,
  correction: FoodCorrection
): FoodAnalysis {
  if (!Number.isInteger(foodIndex) || foodIndex < 0 || foodIndex >= analysis.foods.length) {
    throw new Error("Choose a valid food to correct.");
  }
  const name = correction.name.trim();
  if (!name || name.length > 120) {
    throw new Error("Enter a food name between 1 and 120 characters.");
  }
  const fields: (keyof Omit<FoodCorrection, "name">)[] = [
    "estimatedGrams", "calories", "protein", "carbs", "fat",
  ];
  for (const field of fields) {
    const value = correction[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100000)) {
      throw new Error("Enter non-negative, realistic numbers for weight and nutrition.");
    }
  }
  const previous = analysis.foods[foodIndex];
  const same = name === previous.name && fields.every(field => correction[field] === undefined || previous[field] === correction[field]);
  if (same) return analysis;

  const foods = analysis.foods.map((food, index) => index === foodIndex ? {
    ...food,
    ...correction,
    name,
    userCorrected: true,
    // Do not reuse old AI/scale provenance for user-entered values.
    weightSource: undefined,
    nutritionSource: undefined,
    scaleReadingGrams: undefined,
    unknownMacros: food.unknownMacros?.filter(field => correction[field] === undefined),
    materialUncertaintyPresent: false,
    proposedClarification: undefined,
  } : food);

  const totalCalories = Math.round(foods.reduce((sum, food) => sum + food.calories, 0) * 10) / 10;
  return foodAnalysisSchema.parse({
    ...analysis,
    foods,
    totalCalories,
    // Replace, never append: prior notes may name an incorrectly predicted ingredient.
    notes: correctionNotes(foods, foodIndex, correction),
    clarifications: analysis.clarifications.filter(item => item.foodIndex !== foodIndex),
  });
}
