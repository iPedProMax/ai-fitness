import { foodAnalysisSchema, type FoodAnalysis } from "./food-analysis";

export type ManualFoodInput = {
  name: string;
  grams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type Macro = "protein" | "carbs" | "fat";

function parseNumber(value: string, label: string, optional = false): number | null {
  if (value.trim() === "") {
    if (optional) return null;
    throw new Error(`${label} is required.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }
  return number;
}

/**
 * Numeric macro columns stay backward-compatible. Missing values are separately
 * marked in unknownMacros, preserving the difference between unknown and zero.
 * Consumers of nutrition totals must honor these flags.
 */
export function makeManualFoodAnalysis(
  items: ManualFoodInput[],
  options: { aiAssisted?: boolean; aiConfidences?: readonly (number | null)[] } = {}
): FoodAnalysis {
  if (items.length < 1 || items.length > 10) {
    throw new Error("Enter between 1 and 10 food items.");
  }
  const foods = items.map((item, index) => {
    const name = item.name.trim();
    if (!name || name.length > 120) {
      throw new Error(`Food ${index + 1} needs a name (up to 120 characters).`);
    }
    const grams = parseNumber(item.grams, "Serving weight", true);
    const protein = parseNumber(item.protein, "Protein", true);
    const carbs = parseNumber(item.carbs, "Carbs", true);
    const fat = parseNumber(item.fat, "Fat", true);
    let calories = parseNumber(item.calories, "Calories", true);
    if (calories === null) {
      if (protein === null || carbs === null || fat === null) {
        throw new Error("Calories are required unless protein, carbs and fat are all entered.");
      }
      calories = Math.round((protein * 4 + carbs * 4 + fat * 9) * 10) / 10;
    }
    const unknownMacros: Macro[] = [
      ...(protein === null ? ["protein" as const] : []),
      ...(carbs === null ? ["carbs" as const] : []),
      ...(fat === null ? ["fat" as const] : []),
    ];
    // A model's own score is only retained for an unedited AI suggestion.
    // Pure manual values have no calibrated numeric confidence.
    const reported = options.aiAssisted ? options.aiConfidences?.[index] : undefined;
    const hasReported = typeof reported === "number" && Number.isFinite(reported) &&
      reported >= 0 && reported <= 1;
    return {
      name,
      estimatedGrams: grams ?? 0,
      calories,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      ...(unknownMacros.length ? { unknownMacros } : {}),
      // Numeric 1 remains a legacy schema placeholder for user-entered data.
      // The explicit source must be consulted before displaying any percentage.
      confidence: hasReported ? reported : 1,
      confidenceSource: hasReported ? "MODEL_REPORTED" as const : "NOT_CALIBRATED" as const,
    };
  });
  return foodAnalysisSchema.parse({
    entryMethod: options.aiAssisted ? "TEXT_AI" : "MANUAL",
    foods,
    totalCalories: foods.reduce((total, item) => total + item.calories, 0),
    notes: options.aiAssisted
      ? "AI-assisted food nutrition suggestions, reviewed and possibly edited by the user. Blank macros mean unknown, not zero."
      : "User-entered nutrition values. Blank macros mean unknown, not zero; no AI verification was performed.",
    clarifications: [],
  });
}
