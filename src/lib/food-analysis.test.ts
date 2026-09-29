import { describe, expect, it } from "vitest";
import { foodAnalysisSchema } from "./food-analysis";

describe("foodAnalysisSchema", () => {
  it("accepts a valid food analysis", () => {
    const result = foodAnalysisSchema.parse({
      foods: [
        {
          name: "White rice",
          estimatedGrams: 180,
          calories: 234,
          protein: 4.3,
          carbs: 51,
          fat: 0.5,
          confidence: 0.9,
        },
      ],
      totalCalories: 234,
      notes: "Portion visually estimated.",
    });

    expect(result.foods[0].name).toBe("White rice");
    expect(result.totalCalories).toBe(234);
  });

  it("rejects negative calories", () => {
    expect(() =>
      foodAnalysisSchema.parse({
        foods: [
          {
            name: "Rice",
            estimatedGrams: 100,
            calories: -200,
            protein: 2,
            carbs: 30,
            fat: 0,
            confidence: 0.8,
          },
        ],
        totalCalories: -200,
        notes: "",
      })
    ).toThrow();
  });
});