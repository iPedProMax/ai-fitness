import { describe, expect, it } from "vitest";
import { normalizeSingleFoodProvider } from "./single-food-provider";
import type { FoodAnalysis } from "@/lib/food-analysis";

const food = { name: "Prepared iced tea", estimatedGrams: 250, calories: 90, protein: 0, carbs: 22, fat: 0, confidence: 0.7 };
const analysis: FoodAnalysis = { foods: [food], totalCalories: 741, notes: "label and glass are one drink", clarifications: [] };

describe("single-item providers", () => {
  it("corrects mismatched total without changing calories or macros", () => {
    expect(normalizeSingleFoodProvider(analysis)).toEqual({ ...analysis, totalCalories: 90 });
  });
  it("rejects fabricated multiple foods instead of dropping them", () => {
    expect(() => normalizeSingleFoodProvider({ ...analysis, foods: [food, food] })).toThrow(/exactly one/);
  });
  it("rejects empty results", () => {
    expect(() => normalizeSingleFoodProvider({ ...analysis, foods: [] })).toThrow(/exactly one/);
  });
});