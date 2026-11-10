import { describe, expect, it } from "vitest";
import { findManualFruits, findManualFruitById, manualFruits, manualFruitNutritionForGrams } from "./manual-fruit-catalog";

describe("Manual-only fruit catalog", () => {
  it("has uniquely identified source-backed fruit entries and complete macros", () => {
    expect(manualFruits.length).toBeGreaterThanOrEqual(50);
    expect(new Set(manualFruits.map(food => food.id)).size).toBe(manualFruits.length);
    for (const food of manualFruits) {
      for (const value of [food.calories100g, food.protein100g, food.carbs100g, food.fat100g]) {
        expect(Number.isFinite(value) && value >= 0).toBe(true);
      }
      expect(food.id).toMatch(/^usda-sr-\d+$/);
    }
  });
  it("finds Filipino names but labels generic substitutes", () => {
    expect(findManualFruits("mangga").some(x => x.name.startsWith("Mango"))).toBe(true);
    expect(findManualFruits("guyabano").some(x => x.name.includes("Soursop"))).toBe(true);
    expect(findManualFruits("lakatan")[0]?.name).toContain("generic");
    expect(findManualFruits("saba").every(x => x.name.includes("generic"))).toBe(true);
  });
  it("returns a non-branded reference and never introduces barcodes", () => {
    const banana = findManualFruits("banana")[0];
    expect(banana).toBeDefined();
    expect(findManualFruitById(banana.id)).toEqual(banana);
    expect("barcode" in banana).toBe(false);
  });
  it("scales nutrition by edible grams without inventing unknown sugar values", () => {
    const banana = findManualFruits("banana")[0];
    const doubled = manualFruitNutritionForGrams(banana, 200);
    expect(doubled.calories).toBe(178);
    expect(doubled.carbs).toBe(45.6);
    const durian = findManualFruits("durian")[0];
    expect(manualFruitNutritionForGrams(durian, 150).sugarG).toBeNull();
  });
  it("rejects invalid weight instead of manufacturing zero nutrition", () => {
    const fruit = manualFruits[0];
    expect(() => manualFruitNutritionForGrams(fruit, 0)).toThrow();
    expect(() => manualFruitNutritionForGrams(fruit, 5001)).toThrow();
  });
});
