import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,it,expect} from "vitest";
import {parseOpenFoodFactsProduct,nutritionForGrams} from "./open-food-facts";
import {foodAnalysisSchema} from "./food-analysis";
import {keepGeminiLabelNutrients} from "./ai/gemini-label-nutrients";

describe("X6 optional nutrients across all food modes",()=>{
 it("reads supported per-100g OFF nutrients and scales a real portion",()=>{
  const result=parseOpenFoodFactsProduct({code:"12345678",product_name:"Packaged drink",nutriments:{"energy-kcal_100g":100, proteins_100g:1,carbohydrates_100g:25,fat_100g:0, sugars_100g:18, fiber_100g:1, sodium_100g:0.1, calcium_100g:0.25, "vitamin-d_100g":0.000002}});
  expect(result).not.toBeNull();
  const portion=nutritionForGrams(result!,200);
  expect(portion).toMatchObject({calories:"200",sugarG:"36",fiberG:"2",sodiumMg:"200",calciumMg:"500",vitaminDMcg:"4"});
 });
 it("never invents unknown OFF nutrients when absent",()=>{
  const result=parseOpenFoodFactsProduct({code:"12345678",product_name:"Rice",nutriments:{"energy-kcal_100g":120}})!;
  expect(result.advancedNutrients100g).toBeUndefined();
  expect(nutritionForGrams(result,100)).not.toHaveProperty("sugarG");
 });
 it("does not interpret high total sugar as added sugar",()=>{
  const result=parseOpenFoodFactsProduct({code:"12345678",product_name:"Drink",nutriments:{carbohydrates_100g:15,sugars_100g:12,"added-sugars_100g":20}})!;
  expect(result.advancedNutrients100g?.addedSugarG).toBeUndefined();
 });
 it("allows supported AI estimates, not unverifiable sugar additions or salt",()=>{
  const parsed=foodAnalysisSchema.parse({foods:[{name:"Steak",estimatedGrams:106,calories:250,protein:28,carbs:0,fat:15,confidence:0.7,nutritionSource:"AI_ESTIMATE",advancedNutrients:{ironMg:2.5,cholesterolMg:95,potassiumMg:300,sodiumMg:800,addedSugarG:0}}],totalCalories:250,notes:"estimate",clarifications:[]});
  const food=keepGeminiLabelNutrients(parsed).foods[0];
  expect(food.advancedNutrients?.ironMg).toBe(2.5);
  expect(food.advancedNutrients?.cholesterolMg).toBe(95);
  expect(food.advancedNutrients?.sodiumMg).toBeUndefined();
  expect(food.advancedNutrients?.addedSugarG).toBeUndefined();
 });
 it("wires existing food and text routes without a new AI request",()=>{
  const root=process.cwd();const photo=readFileSync(join(root,"src/app/api/food/analyze/route.ts"),"utf8");
  const text=readFileSync(join(root,"src/app/api/food/text/route.ts"),"utf8");
  const bar=readFileSync(join(root,"src/components/barcode-lookup.tsx"),"utf8");
  expect(photo).toContain("geminiLabelFoodAnalysisJsonSchema");
  expect(text).toContain("keepGeminiLabelNutrients");
  expect(bar).toContain("advancedFromLabel");
  expect(bar).toContain("as Partial<Record<NutritionKey,string>>");
  expect(text).toContain('reserveAiUsage("analysis")');
 });
});
