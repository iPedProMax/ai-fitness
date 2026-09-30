import {
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

function makeRequest() {
  const formData =
    new FormData();

  formData.append(
    "images",
    new File(
      ["fake-image"],
      "drink.jpg",
      {
        type: "image/jpeg",
      }
    )
  );

  return new Request(
    "http://localhost/api/food/analyze",
    {
      method: "POST",
      body: formData,
    }
  );
}

describe(
  "prepared drink clarification enforcement",
  () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY =
        "test-key";

      createInteractionMock.mockReset();
    });

    it("forces a clarification when an open prepared drink has visible additions that are not fully accounted for", async () => {
      createInteractionMock.mockResolvedValue(
        {
          output_text:
            JSON.stringify({
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

                  preparationState:
                    "OPEN_PREPARED",

                  visibleAdditionsPresent:
                    true,

                  visibleAdditionsFullyAccountedFor:
                    false,

                  materialUncertaintyPresent:
                    false,
                },
              ],

              totalCalories: 32,

              notes:
                "Visible fruit and herb additions are present.",

              clarifications: [],
            }),
        }
      );

      const response =
        await POST(
          makeRequest()
        );

      expect(
        response.status
      ).toBe(200);

      const result =
        await response.json();

      expect(
        result.clarifications
      ).toHaveLength(1);

      expect(
        result.clarifications[0]
          .question
          .toLowerCase()
      ).toContain(
        "add anything else"
      );
    });

    it("still forces the clarification when Gemini says visible additions are already accounted for", async () => {
      createInteractionMock.mockResolvedValue(
        {
          output_text:
            JSON.stringify({
              foods: [
                {
                  name:
                    "Nestea Cleanse Green Tea with Fruit and Herbs",

                  estimatedGrams: 250,

                  calories: 40,

                  protein: 0,

                  carbs: 9,

                  fat: 0,

                  confidence: 0.85,

                  weightSource:
                    "AI_ESTIMATE",

                  nutritionSource:
                    "NUTRITION_LABEL",

                  preparationState:
                    "OPEN_PREPARED",

                  visibleAdditionsPresent:
                    true,

                  visibleAdditionsFullyAccountedFor:
                    true,

                  materialUncertaintyPresent:
                    false,
                },
              ],

              totalCalories: 40,

              notes:
                "The visible fruit and herbs were treated as negligible or already accounted for.",

              clarifications: [],
            }),
        }
      );

      const response =
        await POST(
          makeRequest()
        );

      expect(
        response.status
      ).toBe(200);

      const result =
        await response.json();

      expect(
        result.clarifications
      ).toHaveLength(1);

      expect(
        result.clarifications[0]
          .question
      ).toBe(
        "Did you add anything else to this drink?"
      );

      expect(
        result.clarifications[0]
          .allowCustomAnswer
      ).toBe(true);
    });
  }
);