import { ADVANCED_NUTRIENT_FIELDS, type AdvancedNutrients } from "@/lib/advanced-nutrients";
import { foodAnalysisJsonSchema, type FoodAnalysis } from "@/lib/food-analysis";

/** Only extend Gemini photo output: all other providers keep their original schema. */
export const geminiLabelFoodAnalysisJsonSchema = {
  ...foodAnalysisJsonSchema,
  properties: {
    ...foodAnalysisJsonSchema.properties,
    foods: {
      ...foodAnalysisJsonSchema.properties.foods,
      items: {
        ...foodAnalysisJsonSchema.properties.foods.items,
        properties: {
          ...foodAnalysisJsonSchema.properties.foods.items.properties,
          advancedNutrients: {
            type: "object",
            properties: {
              fiberG: { type: "number", minimum: 0, maximum: 1000 },
              sugarG: { type: "number", minimum: 0, maximum: 1000 },
              addedSugarG: { type: "number", minimum: 0, maximum: 1000 },
              sodiumMg: { type: "number", minimum: 0, maximum: 100000 },
              cholesterolMg: { type: "number", minimum: 0, maximum: 100000 },
              potassiumMg: { type: "number", minimum: 0, maximum: 100000 },
              calciumMg: { type: "number", minimum: 0, maximum: 100000 },
              ironMg: { type: "number", minimum: 0, maximum: 100000 },
              vitaminDMcg: { type: "number", minimum: 0, maximum: 1000 },
            },
          },
        },
      },
    },
  },
} as const;

/** In the existing scanner request: no second provider request or additional credit. */
export const GEMINI_LABEL_NUTRIENT_GUIDANCE = `OPTIONAL EXTENDED FOOD NUTRITION, SAME PHOTO REQUEST.
For each food, return advancedNutrients only when its portion and identity support the value; omit unsupported keys, not zero.
LABEL: For a clear label matching this food, transcribe numeric values for the SAME serving as the macros. Distinguish per-100g from per-serving, check quantity and units; do not derive grams/mg from %DV. A printed zero is valid. Label readings use nutritionSource=NUTRITION_LABEL.
NO LABEL: For a recognized food and plausible portion, OPTIONAL conservative approximate values: fiberG, sugarG, cholesterolMg, potassiumMg, calciumMg, ironMg, vitaminDMcg. Explain estimates in notes, nutritionSource=AI_ESTIMATE. Never present an estimate as a label reading.
Without a readable matching label do NOT estimate sodiumMg or addedSugarG. Total sugar is NOT added sugar. Added sugar is a subset of total sugar, and both must not exceed carbohydrates (allow rounding).
Do not invent ingredients, quantities, or label claims. A scale with a plate needs tare confirmation. For uncertain food, composition or portion, OMIT advancedNutrients entirely. Separate foods must keep separate values. Never fill every key just for completeness.`;

/** Prevent non-label/photo guesses and obvious contradictions from reaching saved snapshots. */
export function keepGeminiLabelNutrients(analysis: FoodAnalysis): FoodAnalysis {
  return {
    ...analysis,
    foods: analysis.foods.map(food => {
      if (!food.advancedNutrients) {
        return { ...food, advancedNutrients: undefined };
      }
      const cleaned: AdvancedNutrients = {};
      for (const field of [...ADVANCED_NUTRIENT_FIELDS, { key: "addedSugarG", label: "Added sugar", unit: "g" }] as const) {
        const value = food.advancedNutrients[field.key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          cleaned[field.key] = value;
        }
      }
      // Do not infer added sugars or sodium from appearance alone.
      if (food.nutritionSource !== "NUTRITION_LABEL") {
        delete cleaned.addedSugarG;
        delete cleaned.sodiumMg;
      }
      // Total sugars include added sugars. Reject contradictory readings, don't silently fix them.
      if (cleaned.sugarG !== undefined && cleaned.sugarG > food.carbs + 0.5) {
        delete cleaned.sugarG;
      }
      if (cleaned.addedSugarG !== undefined &&
          ((cleaned.sugarG !== undefined && cleaned.addedSugarG > cleaned.sugarG + 0.1) ||
            cleaned.addedSugarG > food.carbs + 0.5)) {
        delete cleaned.addedSugarG;
      }
      return { ...food, advancedNutrients: Object.keys(cleaned).length ? cleaned : undefined };
    }),
  };
}