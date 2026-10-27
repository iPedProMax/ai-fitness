import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasMaterialCalorieMacroMismatch, hasSevereCalorieMacroMismatch, hasUnusablePhotoNutrition } from "./nutrition-consistency";
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


describe("severe AI photo nutrition mismatch", () => {
  it("rejects the real 377 kcal versus 7P/4C/1F oats result", () => {
    expect(hasSevereCalorieMacroMismatch({ ...base, name: "Rolled oats", calories: 377,
      protein: 7, carbs: 4, fat: 1 })).toBe(true);
  });
  it("keeps ordinary rounding and moderate differences as nonblocking warnings", () => {
    expect(hasSevereCalorieMacroMismatch(base)).toBe(false);
    expect(hasSevereCalorieMacroMismatch({ ...base, calories: 250, protein: 10, carbs: 45, fat: 8 })).toBe(false);
    expect(hasSevereCalorieMacroMismatch({ ...base, calories: 50, protein: 0, carbs: 5, fat: 0 })).toBe(false);
  });
  it("does not misjudge alcoholic drinks where alcohol supplies calories", () => {
    expect(hasSevereCalorieMacroMismatch({ ...base, name: "Wine", calories: 150,
      protein: 0, carbs: 5, fat: 0 })).toBe(false);
  });
  it("skips unknown macro fields and catches reverse contradictions", () => {
    expect(hasSevereCalorieMacroMismatch({ ...base, calories: 377, protein: 0,
      carbs: 0, fat: 0, unknownMacros: ["carbs"] })).toBe(false);
    expect(hasSevereCalorieMacroMismatch({ ...base, calories: 100, protein: 110,
      carbs: 0, fat: 0 })).toBe(true);
  });
});


describe("unusable image portion checks", () => {
  it("rejects 7-kcal oats with a zero-gram portion and zero confidence", () => {
    expect(hasUnusablePhotoNutrition({ ...base, name: "Quaker Oats Instant Oats",
      estimatedGrams: 0, calories: 7, protein: 0, carbs: 0, fat: 0, confidence: 0 })).toBe(true);
  });
  it("rejects rounded-to-zero serving weight independently of confidence", () => {
    expect(hasUnusablePhotoNutrition({ ...base, estimatedGrams: 0.2 })).toBe(true);
  });
  it("rejects zero confidence independently of serving size", () => {
    expect(hasUnusablePhotoNutrition({ ...base, confidence: 0 })).toBe(true);
  });
  it("allows legitimate low-calorie drinks and zero-calorie water", () => {
    expect(hasUnusablePhotoNutrition({ ...base, name: "Water", estimatedGrams: 250,
      calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 0.6 })).toBe(false);
    expect(hasUnusablePhotoNutrition({ ...base, name: "Plain tea", estimatedGrams: 240,
      calories: 2, protein: 0, carbs: 0, fat: 0, confidence: 0.6 })).toBe(false);
  });
});
