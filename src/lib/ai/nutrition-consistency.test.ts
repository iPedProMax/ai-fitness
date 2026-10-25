import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasMaterialCalorieMacroMismatch } from "./nutrition-consistency";
import type { FoodAnalysis } from "@/lib/food-analysis";

type FoodItem = FoodAnalysis["foods"][number];
const base: FoodItem = {
  name: "Test food", estimatedGrams: 200, calories: 300,
  protein: 10, carbs: 45, fat: 8, confidence: 0.7,
};

describe("non-blocking nutrition consistency notice", () => {
  it("flags the mismatched calorie/macro reading from the drink test", () => {
    expect(hasMaterialCalorieMacroMismatch({ ...base, calories: 52, protein: 0, carbs: 7.9, fat: 0 })).toBe(true);
  });
  it("does not warn for a reasonable meal, rounding, or a tiny calorie item", () => {
    expect(hasMaterialCalorieMacroMismatch(base)).toBe(false);
    expect(hasMaterialCalorieMacroMismatch({ ...base, calories: 100, protein: 0, carbs: 20, fat: 0 })).toBe(false);
    expect(hasMaterialCalorieMacroMismatch({ ...base, calories: 5, protein: 0, carbs: 0, fat: 0 })).toBe(false);
  });
  it("does not mistake manually unknown macros for a confirmed inconsistency", () => {
    expect(hasMaterialCalorieMacroMismatch({ ...base, unknownMacros: ["protein"] })).toBe(false);
  });
  it("shows the notice only for Groq/Cloudflare and explains failed refinement", () => {
    const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('providerId === "groq" || providerId === "cloudflare"');
    expect(page).toContain("foods.some(hasMaterialCalorieMacroMismatch)");
    expect(page).toContain("The previous estimate is still shown.");
  });
});
