import { describe, expect, it } from "vitest";
import { foodAnalysisSchema } from "./food-analysis";
import { applyFoodCorrection } from "./food-correction";

const original = foodAnalysisSchema.parse({
  foods: [
    { name: "Rice", estimatedGrams: 200, calories: 300, protein: 10, carbs: 45, fat: 8, confidence: 0.6, weightSource: "AI_ESTIMATE", nutritionSource: "AI_ESTIMATE" },
    { name: "Egg", estimatedGrams: 50, calories: 75, protein: 6, carbs: 0.5, fat: 5, confidence: 0.8 },
  ],
  totalCalories: 375, notes: "AI guess.",
  clarifications: [
    { id: "variety_0", foodIndex: 0, question: "Which kind of rice?", options: ["White", "Brown"] },
    { id: "egg_1", foodIndex: 1, question: "How many eggs?", options: ["One", "Two"] },
  ],
});
const oats = { name: "Rolled oats", estimatedGrams: 70.6, calories: 270, protein: 9.5, carbs: 46, fat: 4.8 };

describe("manual correction before saving", () => {
  it("updates exactly the selected food and recomputes the total without an AI call", () => {
    const result = applyFoodCorrection(original, 0, oats);
    expect(result.foods[0]).toMatchObject({ ...oats, userCorrected: true });
    expect(result.totalCalories).toBe(345);
    expect(result.foods[1]).toEqual(original.foods[1]);
    expect(original.foods[0].name).toBe("Rice");
    expect(original.totalCalories).toBe(375);
    expect(result.clarifications.map(item => item.id)).toEqual(["egg_1"]);
    expect(result.foods[0].weightSource).toBeUndefined();
    expect(result.foods[0].nutritionSource).toBeUndefined();
    expect(foodAnalysisSchema.safeParse(result).success).toBe(true);
  });
  it("does not misrepresent corrected weights as confirmed scale measurements", () => {
    const measured = foodAnalysisSchema.parse({ ...original, foods: [{ ...original.foods[0], weightSource: "SCALE_MEASURED", scaleReadingGrams: 200 }, original.foods[1]] });
    const result = applyFoodCorrection(measured, 0, oats);
    expect(result.foods[0].scaleReadingGrams).toBeUndefined();
    expect(result.foods[0].weightSource).toBeUndefined();
  });
  it("rejects invalid names, indices and numeric values", () => {
    expect(() => applyFoodCorrection(original, 9, oats)).toThrow();
    expect(() => applyFoodCorrection(original, 0, { ...oats, name: " " })).toThrow();
    expect(() => applyFoodCorrection(original, 0, { ...oats, calories: NaN })).toThrow();
    expect(() => applyFoodCorrection(original, 0, { ...oats, fat: -1 })).toThrow();
  });

  it("accepts a name-only correction and keeps every existing numeric value", () => {
    const result = applyFoodCorrection(original, 0, { name: "Quick cook oatmeal" });
    expect(result.foods[0]).toMatchObject({
      name: "Quick cook oatmeal", estimatedGrams: 200, calories: 300,
      protein: 10, carbs: 45, fat: 8, userCorrected: true,
    });
    expect(result.totalCalories).toBe(375);
    expect(result.foods[1]).toEqual(original.foods[1]);
    expect(result.notes).toContain("still come from the prior estimate");
  });

  it("updates only supplied numeric fields, including an explicit zero", () => {
    const result = applyFoodCorrection(original, 0, { name: "Rolled oats", estimatedGrams: 70.6, fat: 0 });
    expect(result.foods[0]).toMatchObject({
      name: "Rolled oats", estimatedGrams: 70.6, calories: 300,
      protein: 10, carbs: 45, fat: 0,
    });
    expect(result.totalCalories).toBe(375);
  });

  it("retains unknown macro flags when their fields are left blank", () => {
    const data = foodAnalysisSchema.parse({ ...original, foods: [
      { ...original.foods[0], unknownMacros: ["protein", "fat"] }, original.foods[1],
    ] });
    const renamed = applyFoodCorrection(data, 0, { name: "Oat cereal" });
    expect(renamed.foods[0].unknownMacros).toEqual(["protein", "fat"]);
    const corrected = applyFoodCorrection(data, 0, { name: "Oat cereal", protein: 3 });
    expect(corrected.foods[0].unknownMacros).toEqual(["fat"]);
  });

  it("keeps a name-only identical correction as a no-op", () => {
    expect(applyFoodCorrection(original, 0, { name: "Rice" })).toBe(original);
  });
  it("leaves original data unchanged when the values are identical", () => {
    const first = original.foods[0];
    expect(applyFoodCorrection(original, 0, { name: first.name, estimatedGrams: first.estimatedGrams, calories: first.calories, protein: first.protein, carbs: first.carbs, fat: first.fat })).toBe(original);
  });
  it("replaces wrong AI descriptions instead of attaching them to corrected food", () => {
    const noodles = foodAnalysisSchema.parse({
      ...original,
      notes: "These are stir-fried noodles with eggs and cabbage. No chicken is present.",
    });
    const result = applyFoodCorrection(noodles, 0, { name: "Pancit with cabbage and chicken" });
    expect(result.notes).toContain("User confirmed the food as Pancit with cabbage and chicken.");
    expect(result.notes).not.toContain("No chicken is present");
    expect(result.notes).not.toContain("stir-fried noodles with eggs");
    expect(result.notes).toContain("not recalculated for the corrected food");
    expect(result.foods[0].calories).toBe(300);
  });

  it("replaces previous correction notes on subsequent changes rather than stacking stale food names", () => {
    const first = applyFoodCorrection(original, 0, { name: "Rice noodles" });
    const second = applyFoodCorrection(first, 0, { name: "Pancit with chicken" });
    expect(second.notes).toContain("Pancit with chicken");
    expect(second.notes).not.toContain("Rice noodles");
    expect(second.notes.match(/User confirmed the food as/g)).toHaveLength(1);
  });

  it("distinguishes corrected nutrition numbers from unchanged AI estimates", () => {
    const result = applyFoodCorrection(original, 0, { name: "Oats", calories: 270, fat: 0 });
    expect(result.notes).toContain("User supplied these nutrition values: calories, fat");
    expect(result.notes).toContain("Unchanged protein, carbs");
    expect(result.foods[0].calories).toBe(270);
    expect(result.foods[0].fat).toBe(0);
    expect(result.totalCalories).toBe(345);
  });

  it("never claims an edited serving weight is a verified tared measurement", () => {
    const result = applyFoodCorrection(original, 0, { name: "Oats", estimatedGrams: 70.6 });
    expect(result.notes).toContain("not automatically a verified scale measurement");
    expect(result.foods[0].weightSource).toBeUndefined();
  });

});
