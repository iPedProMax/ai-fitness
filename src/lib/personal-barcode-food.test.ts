import {describe,expect,it} from "vitest";
import {personalFoodFromServing,savedRowToCatalog} from "./personal-barcode-food";
const base={barcode:"4800016552113",name:"Nissin Seafood",brand:"Nissin",servingDescription:"40 g",packageDescription:"40 g"};
describe("user-reviewed barcode foods",()=>{
  it("correctly converts the 40g cup to 100g without losing zeroes",()=>{
    const saved=personalFoodFromServing(base,40,{calories:"170",protein:"4",carbs:"24",fat:"0"},"user_reviewed");
    expect(saved).toMatchObject({calories100g:425,protein100g:10,carbs100g:60,fat100g:0});
  });
  it("preserves unknown macros as null rather than zero",()=>{
    const saved=personalFoodFromServing(base,40,{calories:"170",protein:"",carbs:"24",fat:""},"ai_reviewed");
    expect(saved.protein100g).toBeNull();expect(saved.fat100g).toBeNull();
  });
  it("rejects impossible quantities and missing calories",()=>{
    expect(()=>personalFoodFromServing(base,0,{calories:"170",protein:"1",carbs:"1",fat:"1"},"user_reviewed")).toThrow(/serving weight/);
    expect(()=>personalFoodFromServing(base,40,{calories:"",protein:"1",carbs:"1",fat:"1"},"user_reviewed")).toThrow(/Calories/);
    expect(()=>personalFoodFromServing(base,40,{calories:"oops",protein:"1",carbs:"1",fat:"1"},"user_reviewed")).toThrow(/calories/);
    expect(()=>personalFoodFromServing(base,40,{calories:"9999",protein:"1",carbs:"1",fat:"1"},"user_reviewed")).toThrow();
  });
  it("validates persisted rows rather than trusting database JSON",()=>{
    expect(savedRowToCatalog({barcode:base.barcode,name:base.name,brand:base.brand,serving_description:"40 g",package_description:"40 g",calories_100g:425,protein_100g:null,carbs_100g:60,fat_100g:0,source:"user_reviewed"})).toMatchObject({barcode:base.barcode,calories100g:425,protein100g:null});
    expect(savedRowToCatalog({...base,calories_100g:999999})).toBeNull();
  });
});
