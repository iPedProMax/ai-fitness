import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import {
  foodAnalysisJsonSchema,
  foodAnalysisSchema,
  type FoodAnalysis,
} from "../../../../lib/food-analysis";

import { foodAnalysisPrompt } from "../../../../lib/food-analysis-prompt";

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MAX_IMAGES = 6;

type SupportedMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

type GeminiInputPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data: string;
      mime_type: SupportedMimeType;
    };

function getLegacyImage(
  formData: FormData,
  field: string
) {
  const value =
    formData.get(field);

  return value instanceof File
    ? value
    : null;
}

function validateImage(
  image: File
) {
  if (
    !allowedImageTypes.includes(
      image.type
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Only JPG, PNG and WEBP images are supported.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    image.size >
    MAX_IMAGE_SIZE
  ) {
    return NextResponse.json(
      {
        error:
          "Each image must be smaller than 10 MB.",
      },
      {
        status: 400,
      }
    );
  }

  return null;
}

async function createImagePart(
  image: File
): Promise<GeminiInputPart> {
  const bytes = Buffer.from(
    await image.arrayBuffer()
  );

  return {
    type: "image",

    data: bytes.toString(
      "base64"
    ),

    mime_type:
      image.type as SupportedMimeType,
  };
}

function normalizeQuestion(
  question: string
) {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function alreadyHasPreparedDrinkClarification(
  analysis: FoodAnalysis,
  foodIndex: number
) {
  return analysis.clarifications.some(
    (clarification) => {
      if (
        clarification.foodIndex !==
        foodIndex
      ) {
        return false;
      }

      if (
        clarification.id.startsWith(
          "prepared_drink_additions_"
        )
      ) {
        return true;
      }

      const question =
        clarification.question.toLowerCase();

      return (
        question.includes(
          "add anything else"
        ) ||
        question.includes(
          "anything else"
        ) ||
        question.includes(
          "anything added"
        )
      );
    }
  );
}

function enforcePreparedDrinkClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  const injectedClarifications =
    [...analysis.clarifications];

  analysis.foods.forEach(
    (food, foodIndex) => {
      const needsClarification =
        food.preparationState ===
          "OPEN_PREPARED" &&
        food.visibleAdditionsPresent ===
          true;

      if (!needsClarification) {
        return;
      }

      if (
        alreadyHasPreparedDrinkClarification(
          {
            ...analysis,
            clarifications:
              injectedClarifications,
          },
          foodIndex
        )
      ) {
        return;
      }

      injectedClarifications.push({
        id:
          `prepared_drink_additions_${foodIndex}`,

        foodIndex,

        question:
          "Did you add anything else to this drink?",

        options: [
          "Nothing",
          "Sugar",
          "Milk",
          "Other",
        ],

        allowCustomAnswer:
          true,
      });
    }
  );

  return {
    ...analysis,

    clarifications:
      injectedClarifications,
  };
}

function alreadyHasEquivalentClarification(
  analysis: FoodAnalysis,
  foodIndex: number,
  question: string
) {
  const normalizedTarget =
    normalizeQuestion(question);

  return analysis.clarifications.some(
    (clarification) => {
      if (
        clarification.foodIndex !==
        foodIndex
      ) {
        return false;
      }

      return (
        normalizeQuestion(
          clarification.question
        ) === normalizedTarget
      );
    }
  );
}

function enforceMaterialUncertaintyClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  const injectedClarifications =
    [...analysis.clarifications];

  analysis.foods.forEach(
    (food, foodIndex) => {
      if (
        food.materialUncertaintyPresent !==
        true
      ) {
        return;
      }

      const proposed =
        food.proposedClarification;

      if (!proposed) {
        return;
      }

      const currentAnalysis = {
        ...analysis,

        clarifications:
          injectedClarifications,
      };

      if (
        alreadyHasEquivalentClarification(
          currentAnalysis,
          foodIndex,
          proposed.question
        )
      ) {
        return;
      }

      injectedClarifications.push({
        id:
          `material_uncertainty_${foodIndex}`,

        foodIndex,

        question:
          proposed.question,

        options:
          proposed.options,

        allowCustomAnswer:
          proposed.allowCustomAnswer,
      });
    }
  );

  return {
    ...analysis,

    clarifications:
      injectedClarifications,
  };
}

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const stackedImages =
      formData
        .getAll("images")
        .filter(
          (
            value
          ): value is File =>
            value instanceof File
        );

    // Keep compatibility with the old
    // classified-image frontend.
    const legacyImages = [
      getLegacyImage(
        formData,
        "image"
      ),

      getLegacyImage(
        formData,
        "nutritionLabelImage"
      ),

      getLegacyImage(
        formData,
        "packageFrontImage"
      ),

      getLegacyImage(
        formData,
        "scaleImage"
      ),
    ].filter(
      (
        image
      ): image is File =>
        image !== null
    );

    const images =
      stackedImages.length > 0
        ? stackedImages
        : legacyImages;

    if (images.length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one image is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      images.length >
      MAX_IMAGES
    ) {
      return NextResponse.json(
        {
          error:
            `You can analyze up to ${MAX_IMAGES} images at a time.`,
        },
        {
          status: 400,
        }
      );
    }

    for (
      const image of images
    ) {
      const validationError =
        validateImage(image);

      if (validationError) {
        return validationError;
      }
    }

    const apiKey =
      process.env
        .GEMINI_API_KEY;

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

    const input: GeminiInputPart[] =
      [
        {
          type: "text",
          text: foodAnalysisPrompt,
        },

        {
          type: "text",
          text: `
The user supplied ${images.length} image${images.length === 1 ? "" : "s"}.

The images are NOT manually classified.

Infer the purpose of each image yourself.

An image may show:
- food or drink
- another angle of the same food
- nutrition facts
- product packaging
- a digital food scale
- another relevant piece of meal evidence
- a different food item

Do not assume every image represents a separate food.
Do not assume every image represents the same food either.

IMPORTANT INTERNAL PREPARATION SIGNALS

For every returned food item, classify these internal fields when possible:

preparationState

Use:

"OPEN_PREPARED"
when the item is an open or manually prepared drink where ingredients may have been mixed, added, garnished, poured, blended, dissolved, or otherwise customized.

Examples:
- powdered drink mixed into a glass
- coffee prepared in a cup
- tea with visible additions
- smoothie
- drink with fruit, herbs, syrup, milk, honey, sugar, supplements, or similar additions

Use:

"SEALED_PACKAGED"
when the drink is still a sealed packaged product or is clearly being consumed exactly as packaged without preparation or additions.

Use:

"NOT_APPLICABLE"
for solid foods or cases where drink preparation state is not relevant.

visibleAdditionsPresent

Set true when the image visibly shows additions or mix-ins that are not clearly part of the base packaged product.

Examples:
- fruit slices
- herbs
- mint
- lemon
- toppings
- visible syrup
- cream
- other obvious additions

Do NOT set true merely because the drink is open.

visibleAdditionsFullyAccountedFor

Set true when visible additions are already adequately included in the returned calories/macros OR they are so nutritionally negligible that no clarification is useful.

Set false when:
- visible additions exist
- their amounts or nutrition are not sufficiently known
- and that uncertainty could meaningfully affect the calorie or macro estimate

Example:

A labelled powdered Nestea provides 32 kcal for the base drink.

The prepared glass visibly contains fruit/herbs.

If those additions are visible but their nutritional contribution is not confidently accounted for:

preparationState = "OPEN_PREPARED"
visibleAdditionsPresent = true
visibleAdditionsFullyAccountedFor = false

If the additions are tiny garnish and genuinely negligible:

visibleAdditionsFullyAccountedFor = true

Do not fabricate quantities just to mark additions as accounted for.

MATERIAL NUTRITION UNCERTAINTY SIGNALS

For EVERY returned food item, set:

materialUncertaintyPresent

Set it to true only when there is a SPECIFIC unresolved ambiguity that could materially change calories or macronutrients and a concise user question could meaningfully improve the result.

Do NOT set it to true merely because confidence is below 100%.

Do NOT set it to true merely because portion size was visually estimated.

When materialUncertaintyPresent = true:

You MUST also return proposedClarification.

proposedClarification must contain:
- question
- options
- allowCustomAnswer when useful

Choose the SINGLE most useful unresolved nutrition question for that food.

Example:

If Pancit Bihon visibly contains meat but the meat type cannot be distinguished:

materialUncertaintyPresent = true

proposedClarification:
{
  "question": "What meat is in the Pancit Bihon?",
  "options": [
    "Chicken",
    "Pork",
    "Mixed",
    "Not sure"
  ],
  "allowCustomAnswer": true
}

If no concrete nutrition-relevant clarification is needed:

materialUncertaintyPresent = false

and omit proposedClarification.

Do not invent ingredients or uncertainty merely to force a question.

Prepared-drink addition uncertainty is handled by the prepared-drink signals above. Do not duplicate the same uncertainty through proposedClarification unless there is a separate issue.
`,
        },
      ];

    for (
      let index = 0;
      index < images.length;
      index += 1
    ) {
      input.push({
        type: "text",

        text: `IMAGE ${index + 1} OF ${images.length}

Inspect this image and determine its role from the visual evidence.

Associate it with other images only when the connection is reasonably supported.`,
      });

      input.push(
        await createImagePart(
          images[index]
        )
      );
    }

    const interaction =
      await ai.interactions.create(
        {
          model:
            "gemini-3.5-flash-lite",

          input,

          response_format: {
            type: "text",

            mime_type:
              "application/json",

            schema:
              foodAnalysisJsonSchema,
          },
        }
      );

    const outputText =
      interaction.output_text;

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            "Gemini returned no analysis.",
        },
        {
          status: 502,
        }
      );
    }

    const parsed =
      JSON.parse(outputText);

    const parsedResult =
      foodAnalysisSchema.parse(
        parsed
      );

    const withDrinkClarifications =
      enforcePreparedDrinkClarifications(
        parsedResult
      );

    const result =
      enforceMaterialUncertaintyClarifications(
        withDrinkClarifications
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "Gemini food analysis failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Food analysis failed.",
      },
      {
        status: 500,
      }
    );
  }
}