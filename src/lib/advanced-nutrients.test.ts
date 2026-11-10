import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advancedNutrientsSchema, displayAdvancedNutrient, findAdvancedForNamedFood } from "./advanced-nutrients";
import { foodAnalysisSchema } from "./food-analysis";
import { makeManualFoodAnalysis } from "./manual-food";
import { fillMissingFromAi } from "@/components/log-food-panel";

const core = { name: "Soup", grams: "240", calories: "95", protein: "3", carbs: "10", fat: "4" };

describe("Phase X1 advanced nutrient integrity", () => {
  it("persists label-entered values in saved analysis JSON, without changing calories", () => {
    const saved = makeManualFoodAnalysis([{ ...core, fiberG: "2.5", sugarG: "0", saturatedFatG: "1.2", sodiumMg: "560" }]);
    expect(saved.totalCalories).toBe(95);
    expect(saved.foods[0].advancedNutrients).toEqual({ fiberG: 2.5, sugarG: 0, saturatedFatG: 1.2, sodiumMg: 560 });
    expect(foodAnalysisSchema.parse(JSON.parse(JSON.stringify(saved))).foods[0].advancedNutrients?.sodiumMg).toBe(560);
  });
  it("leaves all nutrients absent when never recorded; missing is not 0", () => {
    const saved = makeManualFoodAnalysis([core]);
    expect(saved.foods[0].advancedNutrients).toBeUndefined();
    expect(displayAdvancedNutrient(saved.foods[0].advancedNutrients, "fiberG")).toBe("Unknown");
    expect(displayAdvancedNutrient({ fiberG: 0 }, "fiberG")).toBe("0 g");
  });
  it("validates without changing the required calorie and macro contract", () => {
    expect(advancedNutrientsSchema.safeParse({ sodiumMg: 0, fiberG: 1.1 }).success).toBe(true);
    expect(() => makeManualFoodAnalysis([{ ...core, sodiumMg: "-4" }])).toThrow(/Sodium/);
    expect(() => makeManualFoodAnalysis([{ ...core, fiberG: "pizza" }])).toThrow(/Fiber/);
    expect(() => makeManualFoodAnalysis([{ ...core, sugarG: "1001" }])).toThrow(/Sugar/);
    expect(advancedNutrientsSchema.safeParse({ saturatedFatG: -1 }).success).toBe(false);
    expect(advancedNutrientsSchema.safeParse({ sodiumMg: 100001 }).success).toBe(false);
  });
  it("keeps only provided fields; correctly formats sodium in mg", () => {
    const meal = makeManualFoodAnalysis([{ ...core, sodiumMg: "1200" }]);
    expect(meal.foods[0].advancedNutrients).toEqual({ sodiumMg: 1200 });
    expect(displayAdvancedNutrient(meal.foods[0].advancedNutrients, "sodiumMg")).toBe("1,200 mg");
    expect(displayAdvancedNutrient(meal.foods[0].advancedNutrients, "sugarG")).toBe("Unknown");
  });
  it("does not assign snapshot values to a different food or ambiguous duplicates", () => {
    const foods = [{ name: "Rice", advancedNutrients: { fiberG: 1 } }, { name: "Egg", advancedNutrients: { sugarG: 0 } }];
    expect(findAdvancedForNamedFood(foods, " rice ")?.fiberG).toBe(1);
    expect(findAdvancedForNamedFood(foods, "egg")?.sugarG).toBe(0);
    expect(findAdvancedForNamedFood(foods, "Fish")).toBeUndefined();
    expect(findAdvancedForNamedFood([...foods, foods[0]], "Rice")).toBeUndefined();
  });
  it("retains user-recorded nutrients during optional AI estimates, but does not invent empty keys", () => {
    const aiFood = { name: "Soup", estimatedGrams: 240, calories: 95, protein: 3, carbs: 10, fat: 4, confidence: 0.5 };
    const withSodium = fillMissingFromAi([{ ...core, sodiumMg: "0", fiberG: "3" }], [aiFood]);
    expect(withSodium[0].sodiumMg).toBe("0");
    expect(withSodium[0].fiberG).toBe("3");
    const plain = fillMissingFromAi([core], [aiFood]);
    expect(plain[0]).not.toHaveProperty("fiberG");
    expect(plain[0]).not.toHaveProperty("sodiumMg");
  });
  it("wires optional entry, editing, saved reporting and meal history without any new DB columns", () => {
    const root = process.cwd();
    const log = readFileSync(join(root, "src/components/log-food-panel.tsx"), "utf8");
    const editor = readFileSync(join(root, "src/components/meal-editor.tsx"), "utf8");
    const report = readFileSync(join(root, "src/components/reports-daily-meal-details.tsx"), "utf8");
    const history = readFileSync(join(root, "src/app/meals/page.tsx"), "utf8");
    const schema = readFileSync(join(root, "src/lib/food-analysis.ts"), "utf8");
    expect(log).toContain('Optional advanced nutrients');
    expect(log).toContain('original.sodiumMg');
    expect(editor).toContain('sodiumMg');
    expect(report).toContain('AdvancedNutrientsSummary');
    expect(history).toContain('AdvancedNutrientsSummary');
    expect(schema).toContain('advancedNutrientsSchema.optional()');
    expect(report).not.toMatch(/reserveAiUsage|fetch\(/);
  });
});