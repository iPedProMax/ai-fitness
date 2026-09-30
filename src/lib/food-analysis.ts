import { z } from "zod";

export const weightSourceSchema =
  z.enum([
    "AI_ESTIMATE",
    "SCALE_MEASURED",
  ]);

export const nutritionSourceSchema =
  z.enum([
    "AI_ESTIMATE",
    "NUTRITION_LABEL",
  ]);

export const preparationStateSchema =
  z.enum([
    "OPEN_PREPARED",
    "SEALED_PACKAGED",
    "NOT_APPLICABLE",
  ]);

export const proposedClarificationSchema =
  z.object({
    question: z
      .string()
      .min(1),

    options: z
      .array(
        z.string().min(1)
      )
      .min(1),

    allowCustomAnswer:
      z.boolean().optional(),
  });

export const foodItemSchema =
  z.object({
    name: z
      .string()
      .min(1),

    estimatedGrams:
      z.number().nonnegative(),

    calories:
      z.number().nonnegative(),

    protein:
      z.number().nonnegative(),

    carbs:
      z.number().nonnegative(),

    fat:
      z.number().nonnegative(),

    confidence:
      z.number().min(0).max(1),

    weightSource:
      weightSourceSchema.optional(),

    nutritionSource:
      nutritionSourceSchema.optional(),

    scaleReadingGrams:
      z
        .number()
        .nonnegative()
        .optional(),

    preparationState:
      preparationStateSchema.optional(),

    visibleAdditionsPresent:
      z.boolean().optional(),

    visibleAdditionsFullyAccountedFor:
      z.boolean().optional(),

    materialUncertaintyPresent:
      z.boolean().optional(),

    proposedClarification:
      proposedClarificationSchema.optional(),
  });

export const clarificationSchema =
  z.object({
    id: z
      .string()
      .min(1),

    foodIndex: z
      .number()
      .int()
      .nonnegative(),

    question: z
      .string()
      .min(1),

    options: z
      .array(
        z.string().min(1)
      )
      .min(1),

    allowCustomAnswer:
      z.boolean().optional(),
  });

export const foodAnalysisSchema =
  z.object({
    foods:
      z.array(
        foodItemSchema
      ),

    totalCalories:
      z.number().nonnegative(),

    notes:
      z.string(),

    clarifications:
      z
        .array(
          clarificationSchema
        )
        .default([]),
  });

export type FoodAnalysis =
  z.infer<
    typeof foodAnalysisSchema
  >;

export const foodAnalysisJsonSchema =
  {
    type: "object",

    properties: {
      foods: {
        type: "array",

        items: {
          type: "object",

          properties: {
            name: {
              type: "string",
            },

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

            nutritionSource: {
              type: "string",

              enum: [
                "AI_ESTIMATE",
                "NUTRITION_LABEL",
              ],
            },

            scaleReadingGrams: {
              type: "number",
              minimum: 0,
            },

            preparationState: {
              type: "string",

              enum: [
                "OPEN_PREPARED",
                "SEALED_PACKAGED",
                "NOT_APPLICABLE",
              ],
            },

            visibleAdditionsPresent: {
              type: "boolean",
            },

            visibleAdditionsFullyAccountedFor: {
              type: "boolean",
            },

            materialUncertaintyPresent: {
              type: "boolean",
            },

            proposedClarification: {
              type: "object",

              properties: {
                question: {
                  type: "string",
                },

                options: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                allowCustomAnswer: {
                  type: "boolean",
                },
              },

              required: [
                "question",
                "options",
              ],
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
            "materialUncertaintyPresent",
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

            allowCustomAnswer: {
              type: "boolean",
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