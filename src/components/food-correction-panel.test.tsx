import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { FoodCorrectionPanel } from "./food-correction-panel";
import { foodAnalysisSchema } from "@/lib/food-analysis";

describe("FoodCorrectionPanel", () => {
  it("offers a no-credit correction action for a scanned food", () => {
    const html = renderToStaticMarkup(<FoodCorrectionPanel
      analysis={foodAnalysisSchema.parse({ foods: [{ name: "White rice", estimatedGrams: 200, calories: 300, protein: 10, carbs: 45, fat: 8, confidence: 0.6 }], totalCalories: 300, notes: "", clarifications: [] })}
      onApply={vi.fn()}
    />);
    expect(html).toContain("Wrong prediction?");
    expect(html).toContain("No AI credit needed");
  });

  it("lets users omit nutrition fields without forcing numbers", () => {
    const source = readFileSync(new URL("./food-correction-panel.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (!raw) continue;");
    expect(source).toContain("Only the food name is required.");
    expect(source).toContain("placeholder={`Keep current:");
    expect(source).not.toContain('step="any" required');
  });
});
