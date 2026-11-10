import { describe, expect, it } from "vitest";
import { barcodeNutritionCoverage } from "./nutrition-coverage";

describe("Z3.3 barcode catalog coverage and AI fallback", () => {
  it("marks verified zero values as present, not missing", () => {
    const result = barcodeNutritionCoverage({ calories: "0", protein: 0, carbs: "0.0", fat: 0 });
    expect(result.allKnown).toBe(true);
    expect(result.known).toEqual(["calories", "protein", "carbs", "fat"]);
  });
  it("detects when a database identified a product but did not supply nutrition", () => {
    const result = barcodeNutritionCoverage({ calories: "", protein: "", carbs: "", fat: "" });
    expect(result.allKnown).toBe(false);
    expect(result.anyKnown).toBe(false);
    expect(result.missing).toEqual(["calories", "protein", "carbs", "fat"]);
  });
  it("preserves any known values for a partially described food", () => {
    const result = barcodeNutritionCoverage({ calories: "170", protein: "4", carbs: null, fat: "" });
    expect(result.known).toEqual(["calories", "protein"]);
    expect(result.missing).toEqual(["carbs", "fat"]);
  });
  it("rejects invalid negative, nonnumeric and whitespace-only nutrition", () => {
    const result = barcodeNutritionCoverage({ calories: "--", protein: "   ", carbs: -1, fat: "NaN" });
    expect(result.known).toEqual([]);
    expect(result.allKnown).toBe(false);
  });
});
