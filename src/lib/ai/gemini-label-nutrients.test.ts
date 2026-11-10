import { describe, expect, it } from "vitest";
import { foodAnalysisJsonSchema, foodAnalysisSchema, type FoodAnalysis } from "@/lib/food-analysis";
import { geminiLabelFoodAnalysisJsonSchema, keepGeminiLabelNutrients, GEMINI_LABEL_NUTRIENT_GUIDANCE } from "./gemini-label-nutrients";

const food = {
  name: "Labelled drink", estimatedGrams: 280, calories: 188,
  protein: 4, carbs: 36, fat: 3, confidence: 0.65,
  nutritionSource: "NUTRITION_LABEL" as const,
  advancedNutrients: { sugarG: 28, addedSugarG: 0, fiberG: 0, sodiumMg: 95, potassiumMg: 110, vitaminDMcg: 1.3 },
};
const meal = (foods: FoodAnalysis["foods"]) => foodAnalysisSchema.parse({ foods, totalCalories: 188, notes: "label", clarifications: [] });
describe("Gemini optional nutrition-label nutrients", () => {
  it("extends only the Gemini structured response without mutating the general schema", () => {
    expect(geminiLabelFoodAnalysisJsonSchema.properties.foods.items.properties.advancedNutrients.properties.vitaminDMcg.type).toBe("number");
    expect(foodAnalysisJsonSchema.properties.foods.items.properties).not.toHaveProperty("advancedNutrients");
  });
  it("preserves real zero and legible label values", () => {
    const result = keepGeminiLabelNutrients(meal([food]));
    expect(result.foods[0].advancedNutrients).toMatchObject({ sugarG: 28, addedSugarG: 0, fiberG: 0, sodiumMg: 95, potassiumMg: 110, vitaminDMcg: 1.3 });
  });
  it("retains plausible non-label estimates, not guessed sodium or added sugars", () => {
    const result = keepGeminiLabelNutrients(meal([{ ...food, nutritionSource: "AI_ESTIMATE" }]));
    expect(result.foods[0].advancedNutrients).toMatchObject({ sugarG: 28, fiberG: 0, potassiumMg: 110 });
    expect(result.foods[0].advancedNutrients?.addedSugarG).toBeUndefined();
    expect(result.foods[0].advancedNutrients?.sodiumMg).toBeUndefined();
  });
  it("rejects contradictory sugar totals without changing calories or core macros", () => {
    const result = keepGeminiLabelNutrients(meal([{ ...food, advancedNutrients: { sugarG: 45, addedSugarG: 55, sodiumMg: 60 } }]));
    expect(result.foods[0].advancedNutrients).toEqual({ sodiumMg: 60 });
    expect(result.totalCalories).toBe(188);
    expect(result.foods[0].carbs).toBe(36);
  });
  it("leaves unreported fields unknown and keeps old snapshots compatible", () => {
    const older = foodAnalysisSchema.parse({ foods: [{ name:"Rice", estimatedGrams:100,calories:130,protein:2,carbs:28,fat:0.5, confidence:0.5 }], totalCalories:130, notes:"", clarifications:[] });
    expect(keepGeminiLabelNutrients(older).foods[0].advancedNutrients).toBeUndefined();
  });
  it("does not confuse total sugar with added sugar or invent missing label data", () => {
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("Total sugar is NOT added sugar");
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("OMIT advancedNutrients entirely");
  });
});