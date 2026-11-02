import { describe, expect, it } from "vitest";
import { hasSevereAiTotalCalorieMismatch } from "./text-total-consistency";
const food = (calories: number) => ({
  name: "Food", calories, estimatedGrams: 100, protein: 2, carbs: 10, fat: 1,
  confidence: 0.7,
});
describe("Text AI reported meal total plausibility", () => {
  it("accepts exact totals for one food", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(130)], totalCalories: 130 })).toBe(false);
  });
  it("accepts ordinary rounding for multiple foods", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(129), food(200)], totalCalories: 337 })).toBe(false);
  });
  it("rejects severe single-food total contradictions", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(130)], totalCalories: 850 })).toBe(true);
  });
  it("rejects severe multi-food total contradictions", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(120), food(220)], totalCalories: 100 })).toBe(true);
  });
  it("keeps valid zero-calorie water", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(0)], totalCalories: 0 })).toBe(false);
  });
  it("ignores empty foods for the existing route-level validation", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [], totalCalories: 0 })).toBe(false);
  });
  it("does not treat a small rounding error in a low-calorie meal as severe", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(15)], totalCalories: 19 })).toBe(false);
  });
  it("rejects a model reporting zero for substantial item totals", () => {
    expect(hasSevereAiTotalCalorieMismatch({ foods: [food(220)], totalCalories: 0 })).toBe(true);
  });
});