import {describe,it,expect} from "vitest";
import {gramsFromLabel,suggestedServings} from "./serving-options";
const food={barcode:"3017624010701",name:"Tuna",brand:"",servingDescription:"1 portion (30 g)",packageDescription:"150g",calories100g:180,protein100g:20,carbs100g:1,fat100g:9};
describe("safe serving shortcuts",()=>{
  it("accepts a single mass and converts kg",()=>{expect(gramsFromLabel("1 portion (30 g)")).toBe(30);expect(gramsFromLabel("1 kg")).toBe(1000);});
  it("never treats volume as mass",()=>{expect(gramsFromLabel("250 ml")).toBeNull();expect(gramsFromLabel("2 x 30g / 60g")).toBeNull();});
  it("provides serving and package without inventing a piece weight",()=>{
    expect(suggestedServings(food).map(x=>x.grams)).toEqual([30,100,150]);
    expect(suggestedServings({...food,servingDescription:"1 piece",packageDescription:"250ml"}).map(x=>x.grams)).toEqual([100]);
  });
});
