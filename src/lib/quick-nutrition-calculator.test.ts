import { describe, expect, it } from "vitest";
import { findQuickFoodById, quickFoods, quickNutrition, searchQuickFoods } from "./quick-nutrition-calculator";

describe("Manual quick nutrition calculator", () => {
  const rice = findQuickFoodById("staple-rice-white-cooked")!;
  it("uses USDA cooked-rice values, not dry-rice numbers", () => {
    expect(quickNutrition(rice, 150, "g")).toMatchObject({ grams:150,calories:195,protein:4.04,carbs:42.26,fat:0.42 });
  });
  it("converts weight ounces to grams before nutrition scaling", () => {
    const data = quickNutrition(rice, 2, "oz");
    expect(data.grams).toBeCloseTo(56.70, 2);
    expect(data.calories).toBeCloseTo(73.71, 2);
  });
  it("does not allow mL for solid foods", () => {
    expect(() => quickNutrition(rice, 200, "mL")).toThrow(/mL is only supported/);
  });
  it("only converts mL for reference drinks using an approximate density", () => {
    const milk = findQuickFoodById("drink-milk-whole")!;
    expect(quickNutrition(milk, 200, "mL")).toMatchObject({ grams: 206,calories:125.66 });
    expect(quickNutrition(findQuickFoodById("drink-water")!, 250, "mL")).toMatchObject({ grams:250,calories:0 });
  });
  it("includes all 56 fresh fruit references without losing missing nutrient state", () => {
    expect(quickFoods.filter(food => food.category === "Fruit").length).toBe(56);
    const banana = searchQuickFoods("banana").find(food => food.name.startsWith("Banana"))!;
    expect(quickNutrition(banana, 200, "g")).toMatchObject({ calories:178 });
    const missing = quickFoods.find(food => food.category === "Fruit" && food.sugar100g === null)!;
    expect(quickNutrition(missing, 100, "g").sugarG).toBeNull();
  });
  it("rejects impossible or negative portions", () => {
    expect(() => quickNutrition(rice, 0, "g")).toThrow();
    expect(() => quickNutrition(rice, -1, "g")).toThrow();
    expect(() => quickNutrition(rice, 5000, "oz")).toThrow();
    expect(() => quickNutrition(rice, Infinity, "g")).toThrow();
  });
  it("searches Filipino aliases without adding AI provider calls", () => {
    expect(searchQuickFoods("kanin").some(food => food.id === rice.id)).toBe(true);
    expect(searchQuickFoods("gatas", "Drink").some(food => food.id === "drink-milk-whole")).toBe(true);
  });
});
