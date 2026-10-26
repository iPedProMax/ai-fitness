import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { foodAnalysisSchema } from "./food-analysis";
import { normalizeScaleClarifications } from "./scale-clarification";

function makeAnalysis(
  reading?: number,
  question = "The scale reads 70.6 g. Was the container tared before weighing?"
) {
  return foodAnalysisSchema.parse({
    foods: [
      {
        name: "Rolled oats",
        estimatedGrams: 71,
        calories: 273,
        protein: 9.5,
        carbs: 48,
        fat: 4.9,
        confidence: 0.85,
        weightSource: "AI_ESTIMATE",
        ...(reading == null
          ? {}
          : { scaleReadingGrams: reading }),
      },
    ],
    totalCalories: 273,
    notes: "Estimated from appearance.",
    clarifications: [
      {
        id: "tare_status_0",
        foodIndex: 0,
        question,
        options: ["Yes", "No", "Not sure"],
      },
      {
        id: "brand_0",
        foodIndex: 0,
        question: "Do you know the brand?",
        options: ["I don't know"],
        allowCustomAnswer: true,
      },
    ],
  });
}

describe("scale clarification normalization", () => {
  it("recovers a clearly stated scale reading", () => {
    const result = normalizeScaleClarifications(
      makeAnalysis()
    );

    expect(result.foods[0].scaleReadingGrams).toBe(70.6);
    expect(result.clarifications[0].id).toBe("tare_status_0");
  });

  it("preserves nutrition estimates", () => {
    const original = makeAnalysis();
    const result = normalizeScaleClarifications(original);

    expect(result.totalCalories).toBe(273);
    expect(result.foods[0].calories).toBe(273);
    expect(result.foods[0].protein).toBe(9.5);
    expect(result.foods[0].weightSource).toBe("AI_ESTIMATE");
  });

  it("uses the structured reading when one exists", () => {
    const result = normalizeScaleClarifications(
      makeAnalysis(72)
    );

    expect(result.foods[0].scaleReadingGrams).toBe(72);
    expect(result.clarifications[0].question).toContain(
      "72 g"
    );
  });

  it("removes unusable tare questions", () => {
    const result = normalizeScaleClarifications(
      makeAnalysis(undefined, "Was the container tared?")
    );

    expect(
      result.clarifications.some((item) =>
        item.id.startsWith("tare_status_")
      )
    ).toBe(false);

    expect(result.foods[0].calories).toBe(273);
  });

  it("keeps unrelated brand questions", () => {
    const result = normalizeScaleClarifications(
      makeAnalysis(undefined, "Was the container tared?")
    );

    expect(
      result.clarifications.map((item) => item.id)
    ).toEqual(["brand_0"]);
  });

  it("is connected to the analysis endpoint", () => {
    const route = readFileSync(
      new URL("../app/api/food/analyze/route.ts", import.meta.url),
      "utf8"
    );

    expect(route).toContain(
      "normalizeScaleClarifications("
    );
    expect(route).toContain(
      "ensureFreeProviderScaleClarifications(providerNormalized)"
    );
  });
});