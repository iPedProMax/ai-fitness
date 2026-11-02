import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADVANCED_NUTRIENT_FIELDS, displayAdvancedNutrient, advancedNutrientsSchema } from "./advanced-nutrients";
import { summarizeExpandedNutrients } from "./expanded-nutrient-totals";
import { makeManualFoodAnalysis } from "./manual-food";
import { buildAdvancedNutritionReport, formatRecordedNutrient } from "./advanced-nutrition-report";

const basic = {name:"Milk",grams:"280",calories:"188",protein:"4",carbs:"36",fat:"3"};
describe("X3 selected nutrition fields",()=>{
 it("tracks specified nutrients but does not display saturated fat",()=>{
  expect(ADVANCED_NUTRIENT_FIELDS.map(f=>f.key)).toEqual([
    "fiberG","sugarG","sodiumMg","cholesterolMg","potassiumMg","calciumMg","ironMg","vitaminDMcg"
  ]);
  expect(ADVANCED_NUTRIENT_FIELDS.some(f=>String(f.key)==="saturatedFatG")).toBe(false);
  expect(advancedNutrientsSchema.safeParse({saturatedFatG:2}).success).toBe(true);
 });
 it("keeps exact recorded values and leaves unknown nutrient keys absent",()=>{
  const result=makeManualFoodAnalysis([{...basic,addedSugarG:"25",cholesterolMg:"0",potassiumMg:"380",calciumMg:"280",ironMg:"1.2",vitaminDMcg:"2.5"}]);
  expect(result.foods[0].advancedNutrients).toMatchObject({addedSugarG:25,cholesterolMg:0,potassiumMg:380,calciumMg:280,ironMg:1.2,vitaminDMcg:2.5});
  expect(result.foods[0].advancedNutrients?.sugarG).toBeUndefined();
  expect(displayAdvancedNutrient(result.foods[0].advancedNutrients,"vitaminDMcg")).toBe("2.5 mcg");
  expect(displayAdvancedNutrient(result.foods[0].advancedNutrients,"cholesterolMg")).toBe("0 mg");
 });
 it("validates negative and out-of-range entries without inventing defaults",()=>{
  expect(()=>makeManualFoodAnalysis([{...basic,potassiumMg:"-2"}])).toThrow(/Potassium/);
  expect(()=>makeManualFoodAnalysis([{...basic,vitaminDMcg:"1001"}])).toThrow(/Vitamin D/);
  expect(makeManualFoodAnalysis([basic]).foods[0].advancedNutrients).toBeUndefined();
 });
 it("sums only recorded nutrients and reports partial coverage",()=>{
  const rows=summarizeExpandedNutrients([{advancedNutrients:{sugarG:0,sodiumMg:500}},{advancedNutrients:{sodiumMg:0}}]);
  expect(rows.find(x=>x.key==="sugarG")).toMatchObject({known:1,missing:1,display:"0 g+"});
  expect(rows.find(x=>x.key==="sodiumMg")).toMatchObject({known:2,missing:0,total:500,display:"500 mg"});
  expect(rows.find(x=>x.key==="vitaminDMcg")?.display).toBe("Unknown");
 });
 it("supports new nutrient keys in saved seven-day reporting",()=>{
  const days=buildAdvancedNutritionReport([{
    consumed_at:"2026-11-02T01:00:00Z",
    analysis_snapshot:{foods:[{advancedNutrients:{calciumMg:120,vitaminDMcg:3}},{advancedNutrients:{potassiumMg:400}}]},
  }],["2026-11-02"]);
  expect(days[0].nutrients.calciumMg).toEqual({total:120,known:1,missing:1});
  expect(formatRecordedNutrient(days[0].nutrients.vitaminDMcg,"vitaminDMcg")).toBe("3 mcg+");
 });
 it("wires scanner, correction and report without altering photo provider JSON schemas",()=>{
  const root=process.cwd();
  const scanner=readFileSync(join(root,"src/app/page.tsx"),"utf8");
  const correction=readFileSync(join(root,"src/components/food-correction-panel.tsx"),"utf8");
  const reports=readFileSync(join(root,"src/components/reports-advanced-nutrition.tsx"),"utf8");
  const manual=readFileSync(join(root,"src/components/log-food-panel.tsx"),"utf8");
  expect(scanner).toContain("MealAdvancedNutrientsSummary");
  expect(scanner).toContain("<AdvancedNutrientsSummary values={food.advancedNutrients}");
  expect(correction).toContain("advancedNutrients: advanced");
  expect(reports).toContain("addedSugarG");
  expect(manual).toContain("Vitamin D (mcg)");
 });
});