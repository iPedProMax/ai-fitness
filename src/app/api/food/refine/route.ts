import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  foodAnalysisSchema,
} from "../../../../lib/food-analysis";

import {
  isValidClarificationAnswer,
} from "../../../../lib/clarification-answer";

const refineRequestSchema = z.object({
  analysis: foodAnalysisSchema,
  clarificationId: z.string().min(1),
  answer: z.string().min(1),
});

const followUpClarificationSchema =
  z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    options: z
      .array(z.string().min(1))
      .min(1),
    allowCustomAnswer:
      z.boolean().optional(),
  });

const additiveRefinementSchema =
  z.object({
    updatedName: z.string().min(1),

    addedEstimatedGrams:
      z.number().nonnegative(),

    addedCalories:
      z.number().nonnegative(),

    addedProtein:
      z.number().nonnegative(),

    addedCarbs:
      z.number().nonnegative(),

    addedFat:
      z.number().nonnegative(),

    confidence: z
      .number()
      .min(0)
      .max(1),

    notes: z.string(),

    followUpClarifications:
      z
        .array(
          followUpClarificationSchema
        )
        .default([]),
  });

const additiveRefinementJsonSchema = {
  type: "object",

  properties: {
    updatedName: {
      type: "string",
    },

    addedEstimatedGrams: {
      type: "number",
      minimum: 0,
    },

    addedCalories: {
      type: "number",
      minimum: 0,
    },

    addedProtein: {
      type: "number",
      minimum: 0,
    },

    addedCarbs: {
      type: "number",
      minimum: 0,
    },

    addedFat: {
      type: "number",
      minimum: 0,
    },

    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },

    notes: {
      type: "string",
    },

    followUpClarifications: {
      type: "array",

      items: {
        type: "object",

        properties: {
          id: {
            type: "string",
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
          "question",
          "options",
        ],
      },
    },
  },

  required: [
    "updatedName",
    "addedEstimatedGrams",
    "addedCalories",
    "addedProtein",
    "addedCarbs",
    "addedFat",
    "confidence",
    "notes",
    "followUpClarifications",
  ],
} as const;

function roundNutrition(
  value: number
) {
  return (
    Math.round(value * 10) / 10
  );
}

function combineNotes(
  originalNotes: string,
  newNotes: string
) {
  const original =
    originalNotes.trim();

  const added =
    newNotes.trim();

  if (!original) {
    return added;
  }

  if (!added) {
    return original;
  }

  return `${original} ${added}`;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const requestResult =
      refineRequestSchema.safeParse(
        body
      );

    if (!requestResult.success) {
      return NextResponse.json(
        {
          error:
            "Invalid refinement request.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      analysis,
      clarificationId,
    } = requestResult.data;

    const answer =
      requestResult.data.answer.trim();

    const clarification =
      analysis.clarifications.find(
        (item) =>
          item.id ===
          clarificationId
      );

    if (!clarification) {
      return NextResponse.json(
        {
          error:
            "Clarification was not found.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isValidClarificationAnswer(
        clarification,
        answer
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The selected answer is not a valid clarification option.",
        },
        {
          status: 400,
        }
      );
    }

    const affectedFood =
      analysis.foods[
        clarification.foodIndex
      ];

    if (!affectedFood) {
      return NextResponse.json(
        {
          error:
            "The food connected to this clarification was not found.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * TARE CONFIRMATION
     *
     * Keep this deterministic.
     */
    if (
      clarification.id.startsWith(
        "tare_status_"
      )
    ) {
      const scaleReading =
        affectedFood.scaleReadingGrams;

      if (scaleReading == null) {
        return NextResponse.json(
          {
            error:
              "No readable scale measurement was stored for this food.",
          },
          {
            status: 400,
          }
        );
      }

      const remainingClarifications =
        analysis.clarifications.filter(
          (item) =>
            item.id !==
            clarificationId
        );

      if (answer === "Yes") {
        const currentGrams =
          affectedFood.estimatedGrams;

        if (currentGrams <= 0) {
          return NextResponse.json(
            {
              error:
                "The existing food estimate cannot be converted to the measured scale weight.",
            },
            {
              status: 400,
            }
          );
        }

        const ratio =
          scaleReading /
          currentGrams;

        const updatedFood = {
          ...affectedFood,

          estimatedGrams:
            scaleReading,

          calories: roundNutrition(
            affectedFood.calories *
              ratio
          ),

          protein: roundNutrition(
            affectedFood.protein *
              ratio
          ),

          carbs: roundNutrition(
            affectedFood.carbs *
              ratio
          ),

          fat: roundNutrition(
            affectedFood.fat *
              ratio
          ),

          weightSource:
            "SCALE_MEASURED" as const,
        };

        const updatedFoods =
          analysis.foods.map(
            (food, index) =>
              index ===
              clarification.foodIndex
                ? updatedFood
                : food
          );

        const totalCalories =
          roundNutrition(
            updatedFoods.reduce(
              (
                total,
                food
              ) =>
                total +
                food.calories,
              0
            )
          );

        const tareNote =
          `The user confirmed the container was tared, so the ${scaleReading} g scale reading is being used as measured food weight.`;

        return NextResponse.json({
          ...analysis,

          foods: updatedFoods,

          totalCalories,

          notes:
            combineNotes(
              analysis.notes,
              tareNote
            ),

          clarifications:
            remainingClarifications,
        });
      }

      const tareNote =
        answer === "No"
          ? `The container was not tared, so the ${scaleReading} g scale reading was not used as food-only weight. The food amount remains a visual estimate.`
          : `The container tare status is unknown, so the ${scaleReading} g scale reading was not used as food-only weight. The food amount remains a visual estimate.`;

      const updatedFoods =
        analysis.foods.map(
          (food, index) =>
            index ===
            clarification.foodIndex
              ? {
                  ...food,

                  weightSource:
                    "AI_ESTIMATE" as const,
                }
              : food
        );

      return NextResponse.json({
        ...analysis,

        foods: updatedFoods,

        notes: combineNotes(
          analysis.notes,
          tareNote
        ),

        clarifications:
          remainingClarifications,
      });
    }

    /*
     * ADDITIVE REFINEMENT
     *
     * Gemini is NOT allowed to
     * replace the base nutrition.
     *
     * Gemini only returns the
     * nutrition CONTRIBUTION of
     * confirmed additions.
     *
     * The server performs the
     * final arithmetic.
     */

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const prompt = `
You are refining an existing food nutrition analysis after the user answered a clarification.

IMPORTANT:

You are NOT returning the complete food analysis.

You are returning ONLY an ADDITIVE REFINEMENT PLAN.

The server already has the existing base calories and macronutrients.

DO NOT replace, repeat, subtract, or recalculate the base nutrition.

Your job is to determine the nutrition CONTRIBUTION of the additions confirmed by the user.

The server will add your contribution onto the existing base values.

USER ANSWER IS CONFIRMED FACT

The user's answer is confirmed information.

Do not second-guess whether the stated ingredients exist.

Clarification question:

${clarification.question}

Confirmed answer:

${answer}

Existing affected food:

${JSON.stringify(
  affectedFood,
  null,
  2
)}

Existing complete analysis:

${JSON.stringify(
  analysis,
  null,
  2
)}

ADDITIVE RULES

1. addedCalories, addedProtein, addedCarbs, and addedFat must contain ONLY nutrition contributed by additions confirmed in the answer.

2. Do NOT include the existing food's calories or macros inside the added values.

Example:

Existing drink:
32 kcal
7.9 g carbs

Confirmed honey:
192 kcal
52.8 g carbs

Return:

addedCalories = 192
addedCarbs = 52.8

DO NOT return:

addedCalories = 224

The server will calculate:

32 + 192 = 224 kcal

and:

7.9 + 52.8 = 60.7 g carbs.

3. addedEstimatedGrams must represent only the estimated/measured amount of additions whose nutrition you actually included.

4. If the user supplied a quantity, use that quantity reasonably.

Examples:
- "3 tablespoons honey"
- "10 g sugar"
- "100 ml milk"
- "5 g creatine"

5. Natural wording does not need to be perfect.

Examples:
- "3 table spoon"
- "about 3 tbsp"
- "some apple slices"

6. If the answer contains multiple additions, process each confirmed ingredient.

7. CRITICAL UNKNOWN-QUANTITY RULE:

If an ingredient definitely exists but its quantity is unknown AND the quantity could materially affect calories or macronutrients:

DO NOT invent an amount.

DO NOT include guessed calories for that ingredient.

Instead:

- leave its contribution out of the added nutrition for now
- create a follow-up clarification asking for the amount

Example:

User says:

"3 tablespoons honey and lemonade"

Honey quantity is known.

Include the honey contribution.

Lemonade quantity is unknown.

Do not invent 50 ml or 100 ml of lemonade.

Create a clarification such as:

Question:
"How much lemonade was added?"

Options could include:
["A splash", "About 50 ml", "About 100 ml", "Not sure"]

allowCustomAnswer = true

8. If an unknown quantity would have negligible nutritional impact, a conservative estimate may be used.

Examples may include:
- tiny herb garnish
- a small mint leaf
- a thin lemon slice used mainly as garnish

Explain this in notes.

9. Do not turn ingredients of a composed dish or drink into separate food items.

10. updatedName should describe the composed food/drink naturally.

11. Preserve uncertainty honestly with confidence.

12. notes must explain:
- which additions were included
- any quantity estimates
- any confirmed ingredient excluded pending a quantity clarification

13. followUpClarifications must contain only genuinely unresolved questions.

14. Never ask the exact same clarification again.

15. If everything necessary is known, return an empty followUpClarifications array.

Return ONLY the additive refinement plan.
`;

    const interaction =
      await ai.interactions.create({
        model:
          "gemini-3.5-flash-lite",

        input: [
          {
            type: "text",
            text: prompt,
          },
        ],

        response_format: {
          type: "text",

          mime_type:
            "application/json",

          schema:
            additiveRefinementJsonSchema,
        },
      });

    const outputText =
      interaction.output_text;

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            "Gemini returned no refinement plan.",
        },
        {
          status: 502,
        }
      );
    }

    const raw =
      JSON.parse(outputText);

    /*
     * New additive format.
     */
    const additiveResult =
      additiveRefinementSchema.safeParse(
        raw
      );

    if (
      additiveResult.success
    ) {
      const plan =
        additiveResult.data;

      /*
       * SERVER-SIDE ARITHMETIC
       *
       * Gemini cannot overwrite
       * the base numbers here.
       */
      const updatedFood = {
        ...affectedFood,

        name:
          plan.updatedName,

        estimatedGrams:
          roundNutrition(
            affectedFood.estimatedGrams +
              plan.addedEstimatedGrams
          ),

        calories:
          roundNutrition(
            affectedFood.calories +
              plan.addedCalories
          ),

        protein:
          roundNutrition(
            affectedFood.protein +
              plan.addedProtein
          ),

        carbs:
          roundNutrition(
            affectedFood.carbs +
              plan.addedCarbs
          ),

        fat:
          roundNutrition(
            affectedFood.fat +
              plan.addedFat
          ),

        confidence:
          plan.confidence,

        /*
         * Keep the original source.
         *
         * Example:
         * labelled Nestea remains
         * label-backed at its base.
         *
         * The AI-estimated additions
         * are explained in notes.
         */
        nutritionSource:
          affectedFood.nutritionSource,

        weightSource:
          affectedFood.weightSource,

        scaleReadingGrams:
          affectedFood.scaleReadingGrams,
      };

      const updatedFoods =
        analysis.foods.map(
          (food, index) =>
            index ===
            clarification.foodIndex
              ? updatedFood
              : food
        );

      const totalCalories =
        roundNutrition(
          updatedFoods.reduce(
            (
              total,
              food
            ) =>
              total +
              food.calories,
            0
          )
        );

      const oldClarifications =
        analysis.clarifications.filter(
          (item) =>
            item.id !==
            clarificationId
        );

      const generatedClarifications =
        plan.followUpClarifications.map(
          (item) => ({
            ...item,

            foodIndex:
              clarification.foodIndex,
          })
        );

      /*
       * Avoid accidentally restoring
       * the clarification that was
       * just answered.
       */
      const cleanedGenerated =
        generatedClarifications.filter(
          (item) =>
            item.id !==
            clarificationId
        );

      return NextResponse.json({
        ...analysis,

        foods:
          updatedFoods,

        totalCalories,

        notes:
          combineNotes(
            analysis.notes,
            plan.notes
          ),

        clarifications: [
          ...oldClarifications,
          ...cleanedGenerated,
        ],
      });
    }

    /*
     * Temporary backwards-compatible
     * fallback.
     *
     * Existing tests or stale responses
     * may still return the old complete
     * analysis shape.
     */
    const legacyResult =
      foodAnalysisSchema.safeParse(
        raw
      );

    if (
      legacyResult.success
    ) {
      const legacy =
        legacyResult.data;

      return NextResponse.json({
        ...legacy,

        clarifications:
          legacy.clarifications.filter(
            (item) =>
              item.id !==
              clarificationId
          ),
      });
    }

    console.error(
      "Invalid additive refinement response:",
      additiveResult.error
    );

    return NextResponse.json(
      {
        error:
          "Gemini returned an invalid refinement plan.",
      },
      {
        status: 502,
      }
    );
  } catch (error) {
    console.error(
      "Gemini food refinement failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Food refinement failed.",
      },
      {
        status: 500,
      }
    );
  }
}