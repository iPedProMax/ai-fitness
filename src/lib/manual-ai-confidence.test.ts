import { describe, expect, it } from "vitest";
import { matchAiReportedConfidence } from "./manual-ai-confidence";
import type { ManualFoodInput } from "./manual-food";
import type { FoodAnalysis } from "./food-analysis";
const food: FoodAnalysis["foods"][number] = {
  name: "Boiled egg", estimatedGrams: 100, calories: 155,
  protein: 13, carbs: 1.1, fat: 11, confidence: 0.78,
};
const row: ManualFoodInput = {
  name: "Boiled egg", grams: "100", calories: "155",
  protein: "13", carbs: "1.1", fat: "11",
};
describe("manual text confidence provenance", () => {
  it("keeps the exact model-reported score for unchanged values", () => {
    expect(matchAiReportedConfidence([row], [food])).toEqual([0.78]);
  });
  it("does not attach a score to altered calories", () => {
    expect(matchAiReportedConfidence([{ ...row, calories: "140" }], [food])).toEqual([null]);
  });
  it("does not attach a score to unfilled rows or unrelated foods", () => {
    expect(matchAiReportedConfidence([{ ...row, protein: "" }, {...row, name: "Rice"}], [food])).toEqual([null, null]);
  });
  it("does not turn manually entered arbitrary data into a confidence percentage", () => {
    expect(matchAiReportedConfidence([{...row, name: "Banana"}], [])).toEqual([null]);
  });
});