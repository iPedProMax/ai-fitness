import {
  describe,
  expect,
  it,
} from "vitest";

import {
  enforceBrandClarifications,
  isUnknownBrandAnswer,
  skipBrandClarification,
} from "./brand-clarification";

import {
  foodAnalysisSchema,
  foodAnalysisJsonSchema,
} from "./food-analysis";

import { foodAnalysisPrompt } from "./food-analysis-prompt";

function makeAnalysis(
  brandStatus?: "KNOWN" | "UNKNOWN_RELEVANT" | "NOT_RELEVANT"
) {
  return foodAnalysisSchema.parse({
    foods: [
      {
        name: "Oats",
        estimatedGrams: 70,
        calories: 270,
        protein: 10,
        carbs: 48,
        fat: 5,
        confidence: 0.8,
        ...(brandStatus ? { brandStatus } : {}),
      },
    ],
    totalCalories: 270,
    notes: "Estimated from appearance.",
    clarifications: [],
  });
}

describe("brand relevance enforcement", () => {
  it("creates a brand question when brand information is relevant", () => {
    const result = enforceBrandClarifications(
      makeAnalysis("UNKNOWN_RELEVANT")
    );

    expect(result.clarifications).toEqual([
      {
        id: "brand_0",
        foodIndex: 0,
        question:
          "Do you know the brand or exact product of Oats?",
        options: ["I don't know"],
        allowCustomAnswer: true,
      },
    ]);
  });

  it("does not ask when brand is known or irrelevant", () => {
    expect(
      enforceBrandClarifications(
        makeAnalysis("KNOWN")
      ).clarifications
    ).toEqual([]);

    expect(
      enforceBrandClarifications(
        makeAnalysis("NOT_RELEVANT")
      ).clarifications
    ).toEqual([]);
  });

  it("does not invent a question when status is missing", () => {
    expect(
      enforceBrandClarifications(
        makeAnalysis()
      ).clarifications
    ).toEqual([]);
  });

  it("does not duplicate a brand question", () => {
    const analysis =
      makeAnalysis("UNKNOWN_RELEVANT");

    analysis.clarifications.push({
      id: "brand_0",
      foodIndex: 0,
      question: "Which brand?",
      options: ["Quaker", "Other"],
    });

    const result =
      enforceBrandClarifications(analysis);

    expect(result.clarifications).toHaveLength(1);
    expect(result.clarifications[0].options).toEqual(
      ["I don't know"]
    );
    expect(
      result.clarifications[0].allowCustomAnswer
    ).toBe(true);
  });

  it("keeps nutrition unchanged when the user does not know", () => {
    const original =
      enforceBrandClarifications(
        makeAnalysis("UNKNOWN_RELEVANT")
      );

    expect(
      isUnknownBrandAnswer("brand_0", "I don't know")
    ).toBe(true);

    const result =
      skipBrandClarification(original, "brand_0");

    expect(result.totalCalories).toBe(270);
    expect(result.foods).toEqual(original.foods);
    expect(result.notes).toBe(original.notes);
    expect(result.clarifications).toEqual([]);
  });

  it("supports brand status in structured output", () => {
    expect(
      makeAnalysis("UNKNOWN_RELEVANT").foods[0].brandStatus
    ).toBe("UNKNOWN_RELEVANT");

    expect(JSON.stringify(foodAnalysisJsonSchema)).toContain(
      '"brandStatus"'
    );
  });

  it("provides explicit classification instructions", () => {
    expect(foodAnalysisPrompt).toContain(
      '"UNKNOWN_RELEVANT"'
    );
    expect(foodAnalysisPrompt).toContain(
      '"NOT_RELEVANT"'
    );
    expect(foodAnalysisPrompt).toContain(
      '"KNOWN"'
    );
  });
});