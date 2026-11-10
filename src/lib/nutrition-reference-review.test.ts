import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findNutritionReferenceWarnings as review } from "./nutrition-reference-review";

describe("Phase U10A conservative nutrition reference warnings", () => {
  it("flags the real rice underestimation from the U9 live screenshot", () => {
    const warnings = review([{ name: "Cooked white rice (long-grain, plain)", grams: "150", calories: "153" }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("~130 kcal/100 g");
    expect(warnings[0]).toContain("COOKED");
  });
  it("accepts reasonable 150 g cooked rice and the observed 50 g boiled egg", () => {
    expect(review([
      { name: "Cooked white rice (long-grain, plain)", grams: "150", calories: "195" },
      { name: "Large boiled egg (whole, with shell removed)", grams: "50", calories: "72" },
    ])).toEqual([]);
  });
  it("never compares dry rice, fried rice, porridge or glutinous rice to plain cooked rice", () => {
    expect(review([
      { name: "Raw white rice", grams: "100", calories: "365" },
      { name: "Fried cooked white rice", grams: "150", calories: "400" },
      { name: "Cooked white rice porridge", grams: "150", calories: "65" },
      { name: "Cooked glutinous white rice", grams: "150", calories: "320" },
    ])).toEqual([]);
  });
  it("ignores absent or invalid weight and calorie entries and does not mutate inputs", () => {
    const rows = [
      { name: "Cooked white rice", grams: "", calories: "153" },
      { name: "Cooked white rice", grams: "150", calories: "" },
      { name: "Cooked white rice", grams: "150", calories: "nope" },
    ];
    const prior = JSON.stringify(rows);
    expect(review(rows)).toEqual([]);
    expect(JSON.stringify(rows)).toBe(prior);
  });
  it("displays warnings only as advisory information without changing the meal data", () => {
    const source = readFileSync(join(process.cwd(), "src/components/log-food-panel.tsx"), "utf8");
    expect(source).toContain('aiAssisted ? findNutritionReferenceWarnings(items) : []');
    expect(source).toContain('Check these AI estimates before saving');
    expect(source).toContain('Nothing is changed automatically');
  });
});