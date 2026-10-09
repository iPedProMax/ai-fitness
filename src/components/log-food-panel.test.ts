import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillMissingFromAi } from "./log-food-panel";
import type { ManualFoodInput } from "@/lib/manual-food";
import type { FoodAnalysis } from "@/lib/food-analysis";

const blank: ManualFoodInput = {
  name: "", grams: "", calories: "", protein: "", carbs: "", fat: "",
};
const fish: FoodAnalysis["foods"][number] = {
  name: "Grilled bangus", estimatedGrams: 200, calories: 280,
  protein: 40, carbs: 0, fat: 12, confidence: 0.7,
};

describe("combined manual and AI food entry", () => {
  it("fills empty fields from AI while preserving user-entered calories", () => {
    expect(fillMissingFromAi([{ ...blank, name: "Grilled bangus", calories: "250" }], [fish])).toEqual([
      { name: "Grilled bangus", grams: "200", calories: "250", protein: "40", carbs: "0", fat: "12" },
    ]);
  });
  it("creates editable food rows from a multi-food AI estimate", () => {
    const result = fillMissingFromAi([blank], [fish, {
      name: "Cooked rice", estimatedGrams: 180, calories: 234,
      protein: 4, carbs: 51, fat: 0.5, confidence: 0.7,
    }]);
    expect(result).toHaveLength(2);
    expect(result[1].calories).toBe("234");
  });
  it("never discards unmatched existing foods", () => {
    const result = fillMissingFromAi([{ ...blank, name: "Banana", calories: "100" }], [fish, {
      ...fish, name: "Rice",
    }]);
    expect(result).toHaveLength(3);
    expect(result[2].name).toBe("Banana");
  });
  it("has a single unified form with optional AI and a review action", () => {
    const source = readFileSync(new URL("./log-food-panel.tsx", import.meta.url), "utf8");
    expect(source).toContain("Manual / AI Food Entry");
    expect(source).not.toContain('setMode("manual")');
    expect(source).toContain("Estimate nutrition with AI");
    expect(source).toContain("foodEmoji(item.name)");
    expect(source).toContain("Review &amp; Add Meal");
  });
});
