import {describe,it,expect} from "vitest";
import {recipeOneServing} from "./recipe-utils";
describe("recipe portions",()=>{
  it("divides ingredient quantities by number of servings",()=>{
    const r=recipeOneServing({title:"Egg rice",servings:2,ingredients:[{name:"Rice",grams:"200",calories:"260",protein:"6",carbs:"56",fat:"1"}]});
    expect(r.analysis.totalCalories).toBe(130);expect(r.analysis.foods[0].estimatedGrams).toBe(100);
  });
  it("rejects recipe without nutrition",()=>{
    expect(()=>recipeOneServing({title:"Not real",servings:2,ingredients:[{name:"Rice",grams:"200",calories:"",protein:"",carbs:"",fat:""}]})).toThrow();
  });
});
