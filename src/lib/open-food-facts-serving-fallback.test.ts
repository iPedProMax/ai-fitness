import {describe,it,expect} from "vitest";
import {parseOpenFoodFactsProduct,nutritionForGrams} from "./open-food-facts";

describe("Z3.3 Open Food Facts: safe serving nutrition autofill",()=>{
  it("uses normalized per-serving nutrition when per-100g is absent and grams are explicit",()=>{
    const food=parseOpenFoodFactsProduct({
      code:"4800016552113",product_name:"Example noodles",serving_size:"1 cup (40 g)",
      nutriments:{"energy-kcal_serving":170,"proteins_serving":4,"carbohydrates_serving":24,"fat_serving":7,"sugars_serving":2},
    });
    expect(food).not.toBeNull();
    expect(food).toMatchObject({calories100g:425,protein100g:10,carbs100g:60,fat100g:17.5});
    expect(nutritionForGrams(food!,40)).toMatchObject({calories:"170",protein:"4",carbs:"24",fat:"7",sugarG:"2"});
  });
  it("uses normalized serving_quantity if provided without textual grams",()=>{
    const food=parseOpenFoodFactsProduct({
      code:"4800016552113",product_name:"Example 2",serving_size:"one serving",serving_quantity:40,
      nutriments:{"energy-kcal_serving":160},
    });
    expect(food?.calories100g).toBe(400);
  });
  it("does not pretend a bare 'one cup' means an arbitrary weight",()=>{
    const food=parseOpenFoodFactsProduct({
      code:"4800016552113",product_name:"Example",serving_size:"1 cup",
      nutriments:{"energy-kcal_serving":170,"proteins_serving":4},
    });
    expect(food?.calories100g).toBeNull();
    expect(food?.protein100g).toBeNull();
  });
  it("prefers explicit per-100g values when available, even if per-serving differs",()=>{
    const food=parseOpenFoodFactsProduct({
      code:"4800016552113",product_name:"Example",serving_size:"40g",
      nutriments:{"energy-kcal_100g":450,"energy-kcal_serving":170,"proteins_100g":11,"proteins_serving":4},
    });
    expect(food?.calories100g).toBe(450);
    expect(food?.protein100g).toBe(11);
  });
});
