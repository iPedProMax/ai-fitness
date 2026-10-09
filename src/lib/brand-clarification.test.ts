import {
  describe,
  expect,
  it,
} from "vitest";

import { foodAnalysisSchema } from "./food-analysis";

import {
  isUnknownBrandAnswer,
  skipBrandClarification,
} from "./brand-clarification";

import {
  foodAnalysisPrompt,
} from "./food-analysis-prompt";

const sampleAnalysis = foodAnalysisSchema.parse({
  foods: [
    {
      name: "Oats",
      estimatedGrams: 40,
      calories: 150,
      protein: 5,
      carbs: 27,
      fat: 3,
      confidence: 0.65,
    },
  ],
  totalCalories: 150,
  notes: "Nutrition estimated from appearance.",
  clarifications: [
    {
      id: "brand_0",
      foodIndex: 0,
      question: "Do you know the brand of these oats?",
      options: ["I don't know"],
      allowCustomAnswer: true,
    },
    {
      id: "portion_0",
      foodIndex: 0,
      question: "How large was the portion?",
      options: ["Small", "Medium", "Large"],
    },
  ],
});

describe("brand clarification", () => {
  it("recognizes an unknown brand answer", () => {
    expect(
      isUnknownBrandAnswer("brand_0", "I don't know")
    ).toBe(true);

    expect(
      isUnknownBrandAnswer("brand_1", " i don't know ")
    ).toBe(true);
  });

  it("does not skip a known brand or other questions", () => {
    expect(
      isUnknownBrandAnswer("brand_0", "Quaker")
    ).toBe(false);

    expect(
      isUnknownBrandAnswer("portion_0", "I don't know")
    ).toBe(false);
  });

  it("preserves calories and macros when brand is unknown", () => {
    const result = skipBrandClarification(
      sampleAnalysis,
      "brand_0"
    );

    expect(result.totalCalories).toBe(150);
    expect(result.foods).toEqual(sampleAnalysis.foods);
    expect(result.notes).toBe(sampleAnalysis.notes);

    expect(
      result.clarifications.map((item) => item.id)
    ).toEqual(["portion_0"]);
  });

  it("instructs the AI to ask optional brand questions", () => {
    expect(foodAnalysisPrompt).toContain(
      "BRAND CLARIFICATION (OPTIONAL)"
    );

    expect(foodAnalysisPrompt).toContain(
      "brand_<foodIndex>"
    );

    expect(foodAnalysisPrompt).toContain(
      "I don't know"
    );

    expect(foodAnalysisPrompt).toContain(
      "allowCustomAnswer: true"
    );
  });
});
