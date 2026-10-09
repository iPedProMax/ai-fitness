import { describe, it, expect } from "vitest";
import { makeManualFoodAnalysis, type ManualFoodInput } from "./manual-food";
const item: ManualFoodInput = { name: "Grilled bangus", grams: "150", calories: "250", protein: "35", carbs: "0", fat: "12" };
describe("manual and AI-assisted nutrition entry", () => {
  it("preserves known numeric values including real zero", () => {
    const result = makeManualFoodAnalysis([item]);
    expect(result.entryMethod).toBe("MANUAL");
    expect(result.totalCalories).toBe(250);
    expect(result.foods[0]).toMatchObject({ name: "Grilled bangus", estimatedGrams: 150, protein: 35, carbs: 0, fat: 12 });
    expect(result.foods[0].unknownMacros).toBeUndefined();
    expect(result.clarifications).toEqual([]);
  });
  it("sums multiple foods", () => {
    expect(makeManualFoodAnalysis([item, { ...item, calories: "100" }]).totalCalories).toBe(350);
  });
  it("accepts a missing serving weight", () => {
    expect(makeManualFoodAnalysis([{ ...item, grams: "" }]).foods[0].estimatedGrams).toBe(0);
  });
  it("marks omitted macros as unknown rather than claiming zero", () => {
    const result = makeManualFoodAnalysis([{...item, protein: "", carbs: "", fat: ""}]);
    expect(result.foods[0].unknownMacros).toEqual(["protein", "carbs", "fat"]);
    expect(result.foods[0].calories).toBe(250);
  });
  it("rejects blank calories when macros are incomplete", () => {
    expect(() => makeManualFoodAnalysis([{...item, calories: "", protein: ""}])).toThrow(/Calories are required/);
  });
  it("calculates approximate calories from all three macros when calories missing", () => {
    expect(makeManualFoodAnalysis([{...item, calories: ""}]).foods[0].calories).toBe(248);
  });
  it("rejects negative calories", () => {
    expect(() => makeManualFoodAnalysis([{ ...item, calories: "-5" }])).toThrow(/Calories/);
  });
  it("requires a food name", () => {
    expect(() => makeManualFoodAnalysis([{ ...item, name: " " }])).toThrow(/needs a name/);
  });
  it("tracks AI-assisted entries separately", () => {
    const result = makeManualFoodAnalysis([item], { aiAssisted: true });
    expect(result.entryMethod).toBe("TEXT_AI");
    expect(result.notes).toMatch(/AI-assisted/);
  });
});
