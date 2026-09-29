import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  foodAnalysisJsonSchema,
  foodAnalysisSchema,
} from "../../../../lib/food-analysis";

const refineRequestSchema = z.object({
  analysis: foodAnalysisSchema,
  clarificationId: z.string().min(1),
  answer: z.string().min(1),
});

function roundNutrition(value: number) {
  return Math.round(value * 10) / 10;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const requestResult =
      refineRequestSchema.safeParse(body);

    if (!requestResult.success) {
      return NextResponse.json(
        {
          error: "Invalid refinement request.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      analysis,
      clarificationId,
      answer,
    } = requestResult.data;

    const clarification =
      analysis.clarifications.find(
        (item) =>
          item.id === clarificationId
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
      !clarification.options.includes(
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
     * This is deliberately deterministic.
     * We do not need another Gemini call just
     * to interpret Yes / No / Not sure.
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
          scaleReading / currentGrams;

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
              (total, food) =>
                total +
                food.calories,
              0
            )
          );

        const tareNote = `The user confirmed the container was tared, so the ${scaleReading} g scale reading is being used as measured food weight.`;

        return NextResponse.json({
          ...analysis,
          foods: updatedFoods,
          totalCalories,
          notes: analysis.notes
            ? `${analysis.notes} ${tareNote}`
            : tareNote,
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
        notes: analysis.notes
          ? `${analysis.notes} ${tareNote}`
          : tareNote,
        clarifications:
          remainingClarifications,
      });
    }

    /*
     * NORMAL INGREDIENT CLARIFICATION
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

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are refining an existing food nutrition analysis.

The user has answered a clarification question.

IMPORTANT:
The user's answer is a CONFIRMED FACT.
Do not second-guess or override the user's answer.

Clarification question:
${clarification.question}

Confirmed answer:
${answer}

Affected food:
${JSON.stringify(affectedFood, null, 2)}

Current complete analysis:
${JSON.stringify(analysis, null, 2)}

Refinement rules:

1. Recalculate the nutrition of the affected food using the confirmed answer.

2. Keep the estimated portion weight the same unless changing it is absolutely required.

3. Update the affected food's:
- name
- calories
- protein
- carbohydrates
- fat
- confidence

4. Do not change unrelated food items.

5. Preserve weightSource and scaleReadingGrams unless the clarification specifically concerns measurement.

6. Recalculate totalCalories after updating the affected item.

7. Remove the clarification that was just answered.

8. Preserve any other unresolved clarification questions.

9. Do not ask the same clarification again.

10. The confirmed ingredient does not make the entire visual estimate certain.

Other uncertainty such as portion size, cooking oil, sauce, cooking method, and hidden ingredients must still be reflected in confidence and notes.

11. Do not claim exact nutrition when portions or preparation are estimated.

Return the complete updated food analysis.
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
            foodAnalysisJsonSchema,
        },
      });

    const outputText =
      interaction.output_text;

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            "Gemini returned no refined analysis.",
        },
        {
          status: 502,
        }
      );
    }

    const parsed =
      JSON.parse(outputText);

    const refined =
      foodAnalysisSchema.parse(
        parsed
      );

    const cleanedResult = {
      ...refined,

      clarifications:
        refined.clarifications.filter(
          (item) =>
            item.id !==
            clarificationId
        ),
    };

    return NextResponse.json(
      cleanedResult
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