import { describe, expect, it } from "vitest";
import { ADVANCED_NUTRIENT_FIELDS, EXTERNAL_AI_SITES, EXTERNAL_WEB_FOOD_PROMPT, makeReviewedExternalFoodAnalysis, parseExternalFoodImport } from "./external-gemini-import";

const food = { name: "Rolled oats", grams: 70.6, calories: 266, protein: 9.2, carbs: 46.6, fat: 4.6 };
describe("Q4.13B external web AI imports: advanced nutrition and provider selection", () => {
  it("offers popular external sites without server/API integrations", () => {
    expect(EXTERNAL_AI_SITES.map(site => site.id)).toEqual(expect.arrayContaining(["gemini", "chatgpt", "deepseek", "grok", "claude", "copilot", "perplexity"]));
    expect(EXTERNAL_AI_SITES.every(site => site.url.startsWith("https://"))).toBe(true);
    expect(EXTERNAL_WEB_FOOD_PROMPT).toContain("vitaminDMcg");
    expect(EXTERNAL_WEB_FOOD_PROMPT).toContain("tared");
  });
  it("imports all advanced nutrients and persists them through manual schema", () => {
    const nutrients = { fiberG: 7, sugarG: 1, saturatedFatG: 0.5, addedSugarG: 0, sodiumMg: 2, cholesterolMg: 0, potassiumMg: 190, calciumMg: 32, ironMg: 2.3, vitaminDMcg: 0 };
    const imported = parseExternalFoodImport(JSON.stringify({ foods: [{ ...food, ...nutrients }] }));
    const analysis = makeReviewedExternalFoodAnalysis(imported, "chatgpt");
    expect(analysis.entryMethod).toBe("MANUAL");
    expect(analysis.foods[0].advancedNutrients).toEqual(nutrients);
    expect(analysis.notes).toContain("ChatGPT");
    expect(analysis.notes).toContain("No Khalories AI scan");
  });
  it("handles nested advancedNutrients and never turns unknown fields into zero", () => {
    const imported = parseExternalFoodImport(JSON.stringify({ foods: [{...food, fiberG: null, advancedNutrients: { sodiumMg: 90, ironMg: null }}] }));
    expect(imported.items[0].fiberG).toBe("");
    expect(imported.items[0].ironMg).toBe("");
    expect(imported.items[0].sodiumMg).toBe("90");
    expect(makeReviewedExternalFoodAnalysis(imported, "grok").foods[0].advancedNutrients).toEqual({ sodiumMg: 90 });
  });
  it("supports older six-field JSON and all secondary fields are optional", () => {
    const imported = parseExternalFoodImport(JSON.stringify({ foods: [food] }));
    expect(imported.items[0].fiberG).toBe("");
    expect(ADVANCED_NUTRIENT_FIELDS).toHaveLength(10);
    expect(makeReviewedExternalFoodAnalysis(imported).foods[0].advancedNutrients).toBeUndefined();
  });
  it("rejects invalid amounts rather than saving misleading minerals", () => {
    const invalid = parseExternalFoodImport(JSON.stringify({ foods: [{ ...food, fiberG: 1500 }] }));
    expect(() => makeReviewedExternalFoodAnalysis(invalid)).toThrow();
    expect(() => parseExternalFoodImport(JSON.stringify({ foods: [{ ...food, ironMg: "5mg" }] }))).toThrow();
  });
});
