/**
 * A compact, strict subset of Khalories' food-analysis output contract.
 * Only Mistral TEXT nutrition estimates use this schema, not Coach FONZ or Vision.
 * The existing /api/food/text route is authoritative for Zod validation,
 * zero/negative values, nutrition plausibility, totals, and brand/variety checks.
 * JSON-schema mode improves structural reliability; it cannot guarantee calories.
 */
const brandOrVariety = ["KNOWN", "UNKNOWN_RELEVANT", "NOT_RELEVANT"] as const;
const num = { type: "number" } as const;
const text = { type: "string" } as const;
const foodProperties = {
  name: text,
  estimatedGrams: num,
  calories: num,
  protein: num,
  carbs: num,
  fat: num,
  confidence: num,
  brandStatus: { type: "string", enum: brandOrVariety },
  varietyStatus: { type: "string", enum: brandOrVariety },
  materialUncertaintyPresent: { type: "boolean" },
} as const;

export const mistralManualNutritionSchema = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: foodProperties,
        required: Object.keys(foodProperties),
        additionalProperties: false,
      },
    },
    totalCalories: num,
    notes: text,
    clarifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: text,
          foodIndex: { type: "integer" },
          question: text,
          options: { type: "array", items: text },
        },
        required: ["id", "foodIndex", "question", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["foods", "totalCalories", "notes", "clarifications"],
  additionalProperties: false,
} as const;