import { describe, expect, it } from "vitest";
import { GEMINI_WEB_FOOD_PROMPT, makeReviewedExternalFoodAnalysis, parseExternalFoodImport } from "./external-gemini-import";

const base = { foods: [{ name: "Rolled oats", grams: 70.6, calories: 265, protein: 9, carbs: 48, fat: 5 }], notes: "Confirm container tare." };
describe("External Gemini Web Import without app AI calls", () => {
  it("supplies a prompt for manually sharing photos and JSON", () => {
    expect(GEMINI_WEB_FOOD_PROMPT).toContain("JSON");
    expect(GEMINI_WEB_FOOD_PROMPT).toContain("tared");
  });
  it("accepts plain JSON and maps serving nutrition", () => {
    const imported = parseExternalFoodImport(JSON.stringify(base));
    expect(imported.items[0]).toMatchObject({ name: "Rolled oats", grams: "70.6", calories: "265" });
    const result = makeReviewedExternalFoodAnalysis(imported);
    expect(result.entryMethod).toBe("MANUAL");
    expect(result.totalCalories).toBe(265);
    expect(result.notes).toContain("Externally generated");
  });
  it("accepts a JSON code fence", () => {
    const imported = parseExternalFoodImport("```json\n" + JSON.stringify(base) + "\n```");
    expect(imported.items).toHaveLength(1);
  });
  it("preserves unknown macros as unknown instead of zero", () => {
    const imported = parseExternalFoodImport(JSON.stringify({ foods: [{ name: "Soup", grams: null, calories: 55, protein: null, carbs: null, fat: null }] }));
    const result = makeReviewedExternalFoodAnalysis(imported);
    expect(result.foods[0].unknownMacros).toEqual(["protein", "carbs", "fat"]);
    expect(result.foods[0].estimatedGrams).toBe(0);
  });
  it("does not treat missing calories as a successful save", () => {
    const imported = parseExternalFoodImport(JSON.stringify({ foods: [{ name: "Unknown meal", grams: null, calories: null, protein: null, carbs: null, fat: null }] }));
    expect(() => makeReviewedExternalFoodAnalysis(imported)).toThrow();
  });
  it("rejects malformed and oversize JSON", () => {
    expect(() => parseExternalFoodImport("hi there")).toThrow();
    expect(() => parseExternalFoodImport("x".repeat(30001))).toThrow();
  });
  it("rejects non-numeric nutrition and too many foods", () => {
    expect(() => parseExternalFoodImport(JSON.stringify({ foods: [{...base.foods[0], calories: "200 kcal"}] }))).toThrow();
    expect(() => parseExternalFoodImport(JSON.stringify({ foods: Array.from({length: 11}, () => base.foods[0]) }))).toThrow();
  });
  it("leaves external nutrition on the manual saving route, not the scanner route", () => {
    const result = makeReviewedExternalFoodAnalysis(parseExternalFoodImport(JSON.stringify(base)));
    expect(result.entryMethod).toBe("MANUAL");
    expect(result.notes).toContain("No Khalories AI scan");
  });
});
