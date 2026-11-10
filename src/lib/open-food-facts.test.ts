import {describe,it,expect} from "vitest";
import {validBarcode,parseOpenFoodFactsProduct,nutritionForGrams} from "./open-food-facts";
describe("Open Food Facts product handling",()=>{
  const input={code:"3017624010701",product_name:"Chocolate spread",brands:"Example",nutriments:{"energy-kcal_100g":550,proteins_100g:6.1,carbohydrates_100g:58,fat_100g:31}};
  it("accepts only numeric barcodes",()=>{expect(validBarcode("3017624010701")).toBe(true);expect(validBarcode("123;DROP")).toBe(false);expect(validBarcode("123")).toBe(false);});
  it("calculates the selected portion rather than per-100g",()=>{const p=parseOpenFoodFactsProduct(input)!;expect(nutritionForGrams(p,50).calories).toBe("275");expect(nutritionForGrams(p,50).protein).toBe("3.1");});
  it("preserves missing nutrients as unknown",()=>{const p=parseOpenFoodFactsProduct({...input,nutriments:{"energy-kcal_100g":100}})!;expect(nutritionForGrams(p,100).fat).toBe("");});
  it("rejects bad portion sizes",()=>{const p=parseOpenFoodFactsProduct(input)!;expect(()=>nutritionForGrams(p,-10)).toThrow();});
  it("rejects products without a usable name",()=>expect(parseOpenFoodFactsProduct({...input,product_name:""})).toBeNull());
});
