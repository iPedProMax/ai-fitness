import { z } from "zod";

export const foodItemSchema = z.object({
  name: z.string().min(1),
  estimatedGrams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const foodAnalysisSchema = z.object({
  foods: z.array(foodItemSchema),
  totalCalories: z.number().nonnegative(),
  notes: z.string(),
});

export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;
export const foodAnalysisJsonSchema = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          estimatedGrams: {
            type: "number",
            minimum: 0,
          },
          calories: {
            type: "number",
            minimum: 0,
          },
          protein: {
            type: "number",
            minimum: 0,
          },
          carbs: {
            type: "number",
            minimum: 0,
          },
          fat: {
            type: "number",
            minimum: 0,
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
        required: [
          "name",
          "estimatedGrams",
          "calories",
          "protein",
          "carbs",
          "fat",
          "confidence",
        ],
      },
    },

    totalCalories: {
      type: "number",
      minimum: 0,
    },

    notes: {
      type: "string",
    },
  },

  required: [
    "foods",
    "totalCalories",
    "notes",
  ],
} as const;