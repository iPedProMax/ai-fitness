import { z } from "zod";

export const weightSourceSchema = z.enum([
  "AI_ESTIMATE",
  "SCALE_MEASURED",
]);

export const foodItemSchema = z.object({
  name: z.string().min(1),
  estimatedGrams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),

  weightSource: weightSourceSchema.optional(),

  // The number actually visible on a digital scale.
  // This does NOT automatically mean food-only weight.
  scaleReadingGrams: z.number().nonnegative().optional(),
});

export const clarificationSchema = z.object({
  id: z.string().min(1),
  foodIndex: z.number().int().nonnegative(),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
});

export const foodAnalysisSchema = z.object({
  foods: z.array(foodItemSchema),
  totalCalories: z.number().nonnegative(),
  notes: z.string(),
  clarifications: z.array(clarificationSchema).default([]),
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
          weightSource: {
            type: "string",
            enum: [
              "AI_ESTIMATE",
              "SCALE_MEASURED",
            ],
          },
          scaleReadingGrams: {
            type: "number",
            minimum: 0,
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

    clarifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          foodIndex: {
            type: "number",
            minimum: 0,
          },
          question: {
            type: "string",
          },
          options: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "id",
          "foodIndex",
          "question",
          "options",
        ],
      },
    },
  },

  required: [
    "foods",
    "totalCalories",
    "notes",
    "clarifications",
  ],
} as const;