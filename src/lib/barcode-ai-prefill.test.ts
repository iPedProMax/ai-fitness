import { describe, expect, it } from "vitest";
import { missingBarcodeTextAiDraft } from "./barcode-ai-prefill";
import type { FoodAnalysis } from "./food-analysis";

const example = {
  name: "Packaged noodles", estimatedGrams: 100, calories: 400,
  protein: 10, carbs: 60, fat: 12, confidence: 0.55,
  advancedNutrients: { fiberG: 3, sugarG: 4, sodiumMg: 600 },
  unknownMacros: ["fat"],
} as FoodAnalysis["foods"][number];

describe("Z3.1 Text-AI barcode draft safety", () => {
  it("does not overwrite known catalog calories or manually entered macros", () => {
    expect(missingBarcodeTextAiDraft({ calories: "210", protein: "7", carbs: "" }, example, 50))
      .toEqual({ carbs: "30" });
  });
  it("keeps unknown macros and label-dependent micronutrients unknown", () => {
    const result = missingBarcodeTextAiDraft({}, example, 100);
    expect(result).toEqual({ calories: "400", protein: "10", carbs: "60" });
    expect(result).not.toHaveProperty("fat");
    expect(result).not.toHaveProperty("sodiumMg");
    expect(result).not.toHaveProperty("fiberG");
    expect(result).not.toHaveProperty("sugarG");
  });
  it("rejects oversized serving conversion rather than applying a wild estimate", () => {
    expect(() => missingBarcodeTextAiDraft({}, example, 1500)).toThrow(/serving size/);
  });
  it("does not override explicit zero values", () => {
    expect(missingBarcodeTextAiDraft({ carbs: "0", protein: 0 }, example, 100).carbs).toBeUndefined();
  });
  it("rejects AI output missing its portion weight when user grams are known", () => {
    expect(() => missingBarcodeTextAiDraft({}, {...example, estimatedGrams: 0}, 40)).toThrow(/serving weight/);
  });
  it("avoids guessed weight scaling when the portion is unknown", () => {
    expect(missingBarcodeTextAiDraft({}, example, null).calories).toBe("400");
  });
});
