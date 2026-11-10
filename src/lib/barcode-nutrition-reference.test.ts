import { describe, expect, it } from "vitest";
import { findReferencedBarcode, supplementExactBarcodeFood } from "./barcode-nutrition-reference";
import { nutritionForGrams, type CatalogFood } from "./open-food-facts";

const blank: CatalogFood = {
  barcode: "4807770272646",
  name: "Lucky Me jjampong artificial spicy seafood flavor noodles",
  brand: "Lucky Me!",
  servingDescription: "70 g",
  calories100g: null, protein100g: null, carbs100g: null, fat100g: null,
};

describe("barcode community nutrition reference Z3.8", () => {
  it("never guesses nutrients for unrelated barcodes", () => {
    expect(findReferencedBarcode("4807770272647")).toBeNull();
    expect(supplementExactBarcodeFood({ ...blank, barcode: "4807770272647" }).calories100g).toBeNull();
  });
  it("recovers nutrition only on the matching barcode", () => {
    const food = supplementExactBarcodeFood(blank);
    expect(food.calories100g).toBe(460);
    expect(food.protein100g).toBe(7.1);
    expect(food.carbs100g).toBe(60);
    expect(food.fat100g).toBe(21.4);
    expect(food.nutritionSourceUrl).toContain("nutrifoodindex");
  });
  it("scales exact barcode community values for the 70g serving", () => {
    const values = nutritionForGrams(supplementExactBarcodeFood(blank), 70);
    expect(values.calories).toBe("322");
    expect(values.protein).toBe("5");
    expect(values.carbs).toBe("42");
    expect(values.fat).toBe("15");
  });
  it("preserves real zero and existing user/community values", () => {
    const food = supplementExactBarcodeFood({ ...blank, calories100g: 0, protein100g: 9, fat100g: 3 });
    expect(food.calories100g).toBe(0);
    expect(food.protein100g).toBe(9);
    expect(food.fat100g).toBe(3);
    expect(food.carbs100g).toBe(60);
  });
  it("does not turn empty other barcodes into a false exact match", () => {
    expect(supplementExactBarcodeFood({ ...blank, barcode: "4807770272653" })).toEqual({ ...blank, barcode: "4807770272653" });
  });
  it("recovers published community values only for exact Nissin Mini Seafood barcode", () => {
    const blankNissin: CatalogFood = {
      ...blank,
      barcode: "4800016552113",
      name: "nc seafood 40g",
      brand: "Nissin",
      servingDescription: "40 g",
    };
    const recovered = supplementExactBarcodeFood(blankNissin);
    expect(recovered).toMatchObject({
      barcode: "4800016552113",
      calories100g: 425,
      protein100g: 10,
      carbs100g: 60,
      fat100g: 17.5,
    });
    expect(recovered.name).toBe("nc seafood 40g"); // Preserve upstream name.
    expect(recovered.nutritionSourceUrl).toContain("nissin-cup-noodles-mini-seafood-flavor");
    expect(nutritionForGrams(recovered, 40)).toMatchObject({
      calories: "170", protein: "4", carbs: "24", fat: "7",
      sugarG: "2", fiberG: "1", sodiumMg: "1056",
    });
    // Never overwrite existing OFF values (including genuine zero).
    const partial = supplementExactBarcodeFood({ ...blankNissin, calories100g: 450, fat100g: 0 });
    expect(partial.calories100g).toBe(450);
    expect(partial.fat100g).toBe(0);
    expect(partial.carbs100g).toBe(60);
    expect(findReferencedBarcode("4800016552114")).toBeNull();
  });
});
