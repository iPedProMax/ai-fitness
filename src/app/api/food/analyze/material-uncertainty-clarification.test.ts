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

describe(
  "material food uncertainty clarification enforcement",
  () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY =
        "test-key";

      createInteractionMock.mockReset();
    });

    it("forces Gemini's proposed clarification when a food has material unresolved nutrition uncertainty", async () => {
      createInteractionMock.mockResolvedValue(
        {
          output_text:
            JSON.stringify({
              foods: [
                {
                  name:
                    "Pancit Bihon",

                  estimatedGrams: 250,

                  calories: 320,

                  protein: 12,

                  carbs: 45,

                  fat: 10,

                  confidence: 0.8,

                  weightSource:
                    "AI_ESTIMATE",

                  nutritionSource:
                    "AI_ESTIMATE",

                  preparationState:
                    "NOT_APPLICABLE",

                  visibleAdditionsPresent:
                    false,

                  visibleAdditionsFullyAccountedFor:
                    true,

                  materialUncertaintyPresent:
                    true,

                  proposedClarification: {
                    question:
                      "What meat is in the Pancit Bihon?",

                    options: [
                      "Chicken",
                      "Pork",
                      "Mixed",
                      "Not sure",
                    ],

                    allowCustomAnswer:
                      true,
                  },
                },
              ],

              totalCalories: 320,

              notes:
                "The meat type could materially affect the nutrition estimate.",

              clarifications: [],
            }),
        }
      );

      const formData =
        new FormData();

      formData.append(
        "images",
        new File(
          ["fake-image"],
          "bihon.jpg",
          {
            type: "image/jpeg",
          }
        )
      );

      const request =
        new Request(
          "http://localhost/api/food/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      const response =
        await POST(request);

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
          .foodIndex
      ).toBe(0);

      expect(
        result.clarifications[0]
          .question
      ).toBe(
        "What meat is in the Pancit Bihon?"
      );

      expect(
        result.clarifications[0]
          .options
      ).toEqual([
        "Chicken",
        "Pork",
        "Mixed",
        "Not sure",
      ]);

      expect(
        result.clarifications[0]
          .allowCustomAnswer
      ).toBe(true);
    });
  }
);