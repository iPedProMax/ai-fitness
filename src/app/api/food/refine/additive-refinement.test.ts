import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  createInteractionMock,
} = vi.hoisted(() => ({
  createInteractionMock: vi.fn(),
}));

vi.mock(
  "@google/genai",
  () => ({
    GoogleGenAI: class {
      interactions = {
        create:
          createInteractionMock,
      };
    },
  })
);

import { POST } from "./route";

describe(
  "additive food refinement",
  () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY =
        "test-key";

      createInteractionMock.mockReset();
    });

    afterEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it("adds confirmed additions on top of the existing base nutrition", async () => {
      createInteractionMock.mockResolvedValue(
        {
          output_text:
            JSON.stringify({
              updatedName:
                "Nestea Cleanse Lemon Cucumber Green Tea with honey and lemonade",

              addedEstimatedGrams: 63,

              addedCalories: 192,

              addedProtein: 0,

              addedCarbs: 52.8,

              addedFat: 0,

              confidence: 0.8,

              notes:
                "The confirmed 3 tablespoons of honey were added to the labelled base drink. Lemonade quantity is still unknown.",

              followUpClarifications: [
                {
                  id: "lemonade_amount",
                  question:
                    "How much lemonade was added?",

                  options: [
                    "A splash",
                    "About 50 ml",
                    "About 100 ml",
                    "Not sure",
                  ],

                  allowCustomAnswer:
                    true,
                },
              ],
            }),
        }
      );

      const analysis = {
        foods: [
          {
            name:
              "Nestea Cleanse Lemon Cucumber Green Tea",

            estimatedGrams: 250,

            calories: 32,

            protein: 0,

            carbs: 7.9,

            fat: 0,

            confidence: 0.9,

            weightSource:
              "AI_ESTIMATE",

            nutritionSource:
              "NUTRITION_LABEL",
          },
        ],

        totalCalories: 32,

        notes:
          "The base drink uses the package nutrition label.",

        clarifications: [
          {
            id: "drink_additions_0",

            foodIndex: 0,

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
          },
        ],
      };

      const request =
        new Request(
          "http://localhost/api/food/refine",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              analysis,

              clarificationId:
                "drink_additions_0",

              answer:
                "honey about 3 table spoon, lemonade",
            }),
          }
        );

      const response =
        await POST(request);

      expect(
        response.status
      ).toBe(200);

      const result =
        await response.json();

      /*
       * BASE:
       * 32 kcal
       * 7.9 g carbs
       *
       * ADDITION:
       * 192 kcal
       * 52.8 g carbs
       *
       * SERVER MUST ADD THEM.
       */
      expect(
        result.foods[0].calories
      ).toBe(224);

      expect(
        result.foods[0].carbs
      ).toBe(60.7);

      expect(
        result.totalCalories
      ).toBe(224);

      /*
       * Lemonade amount is still
       * unknown, so it must remain
       * a clarification instead of
       * silently inventing an amount.
       */
      expect(
        result.clarifications
      ).toHaveLength(1);

      expect(
        result.clarifications[0]
          .question
      ).toContain(
        "How much lemonade"
      );
    });
  }
);