import { readFileSync } from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  foodAnalysisSchema,
  foodAnalysisJsonSchema,
} from "./food-analysis";

import {
  enforceVarietyClarifications,
  isUnknownVarietyAnswer,
  skipVarietyClarification,
} from "./variety-clarification";

import {
  foodAnalysisPrompt,
} from "./food-analysis-prompt";

type VarietyStatus =
  | "KNOWN"
  | "UNKNOWN_RELEVANT"
  | "NOT_RELEVANT";

function makeAnalysis(
  name: string,
  status: VarietyStatus
) {
  return foodAnalysisSchema.parse({
    foods: [
      {
        name,
        estimatedGrams: 200,
        calories: 260,
        protein: 5.4,
        carbs: 57.2,
        fat: 0.6,
        confidence: 0.85,
        brandStatus: "NOT_RELEVANT",
        varietyStatus: status,
      },
    ],
    totalCalories: 260,
    notes: "Estimated from appearance.",
    clarifications: [],
  });
}

describe("smart food variety clarification", () => {
  it("asks about relevant rice varieties", () => {
    const result = enforceVarietyClarifications(
      makeAnalysis(
        "Cooked white rice",
        "UNKNOWN_RELEVANT"
      )
    );

    expect(result.clarifications).toHaveLength(1);

    expect(result.clarifications[0]).toMatchObject({
      id: "variety_0",
      foodIndex: 0,
      allowCustomAnswer: true,
    });

    expect(result.clarifications[0].options).toEqual(
      expect.arrayContaining([
        "Jasmine rice",
        "Basmati rice",
        "I don't know",
      ])
    );
  });

  it("offers suitable choices for oats", () => {
    const result = enforceVarietyClarifications(
      makeAnalysis(
        "Oats",
        "UNKNOWN_RELEVANT"
      )
    );

    expect(result.clarifications[0].options).toEqual(
      expect.arrayContaining([
        "Rolled oats",
        "Instant oats",
        "Steel-cut oats",
        "I don't know",
      ])
    );
  });

  it("allows custom varieties for other foods", () => {
    const result = enforceVarietyClarifications(
      makeAnalysis(
        "Unknown food product",
        "UNKNOWN_RELEVANT"
      )
    );

    expect(result.clarifications[0]).toMatchObject({
      options: ["I don't know"],
      allowCustomAnswer: true,
    });
  });

  it("does not ask when variety is known", () => {
    const result = enforceVarietyClarifications(
      makeAnalysis("Jasmine rice", "KNOWN")
    );

    expect(result.clarifications).toEqual([]);
  });

  it("does not ask when variety is irrelevant", () => {
    const result = enforceVarietyClarifications(
      makeAnalysis("Boiled egg", "NOT_RELEVANT")
    );

    expect(result.clarifications).toEqual([]);
  });

  it("does not duplicate variety questions", () => {
    const analysis = makeAnalysis(
      "Cooked white rice",
      "UNKNOWN_RELEVANT"
    );

    const once =
      enforceVarietyClarifications(analysis);

    const twice =
      enforceVarietyClarifications(once);

    expect(twice.clarifications).toHaveLength(1);
  });

  it("keeps nutrition unchanged when user does not know", () => {
    const original = enforceVarietyClarifications(
      makeAnalysis(
        "Cooked white rice",
        "UNKNOWN_RELEVANT"
      )
    );

    expect(
      isUnknownVarietyAnswer(
        "variety_0",
        "I don't know"
      )
    ).toBe(true);

    const result = skipVarietyClarification(
      original,
      "variety_0"
    );

    expect(result.totalCalories).toBe(260);
    expect(result.foods).toEqual(original.foods);
    expect(result.clarifications).toEqual([]);
  });

  it("does not confuse variety with brand questions", () => {
    expect(
      isUnknownVarietyAnswer(
        "brand_0",
        "I don't know"
      )
    ).toBe(false);
  });

  it("preserves the new variety status in the schema", () => {
    const analysis = makeAnalysis(
      "Rice",
      "UNKNOWN_RELEVANT"
    );

    expect(analysis.foods[0].varietyStatus).toBe(
      "UNKNOWN_RELEVANT"
    );

    expect(
      JSON.stringify(foodAnalysisJsonSchema)
    ).toContain('"varietyStatus"');
  });

  it("has AI instructions for food varieties", () => {
    expect(foodAnalysisPrompt).toContain(
      "FOOD VARIETY CLARIFICATION"
    );
  });

  it("connects the variety logic to the scanner and API", () => {
    const page = readFileSync(
      new URL("../app/page.tsx", import.meta.url),
      "utf8"
    );

    const route = readFileSync(
      new URL(
        "../app/api/food/analyze/route.ts",
        import.meta.url
      ),
      "utf8"
    );

    expect(page).toContain(
      "isUnknownVarietyAnswer"
    );

    expect(route).toContain(
      "enforceVarietyClarifications"
    );
  });
});