import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADVANCED_NUTRIENT_FIELDS, advancedNutrientsSchema } from "./advanced-nutrients";
import { foodAnalysisSchema } from "./food-analysis";
import { summarizeExpandedNutrients } from "./expanded-nutrient-totals";

describe("X7: eight visible nutrients, no lost data", () => {
  it("shows only the requested eight advanced nutrient fields", () => {
    expect(ADVANCED_NUTRIENT_FIELDS.map(field => field.key)).toEqual([
      "fiberG", "sugarG", "sodiumMg", "cholesterolMg", "potassiumMg",
      "calciumMg", "ironMg", "vitaminDMcg",
    ]);
  });
  it("retains already recorded total sugar and hidden historical added sugar independently", () => {
    const snapshot = foodAnalysisSchema.parse({
      foods: [{ name: "Drink", estimatedGrams: 280, calories: 188, protein: 4,
        carbs: 36, fat: 3, confidence: 0.7, advancedNutrients: { sugarG: 30, fiberG: 1.5, addedSugarG: 20 } }],
      totalCalories: 188, notes: "label read", clarifications: [],
    });
    expect(snapshot.foods[0].advancedNutrients?.sugarG).toBe(30);
    expect(snapshot.foods[0].advancedNutrients?.addedSugarG).toBe(20);
    expect(advancedNutrientsSchema.safeParse({ addedSugarG: 20 }).success).toBe(true);
    const rows = summarizeExpandedNutrients(snapshot.foods);
    expect(rows).toHaveLength(8);
    expect(rows.find(row => row.key === "sugarG")?.display).toBe("30 g");
    expect(rows.some(row => String(row.key) === "addedSugarG")).toBe(false);
  });
  it("distinguishes missing from a real recorded zero", () => {
    const rows = summarizeExpandedNutrients([
      { advancedNutrients: { sugarG: 0, sodiumMg: 62 } },
      { advancedNutrients: { sugarG: 30 } },
    ]);
    expect(rows.find(row => row.key === "sugarG")?.display).toBe("30 g");
    expect(rows.find(row => row.key === "sodiumMg")?.display).toBe("62 mg+");
    expect(rows.find(row => row.key === "sodiumMg")?.missing).toBe(1);
  });
  it("keeps save path intact and avoids showing hidden sugar in the common entry controls", () => {
    const load = (p: string) => readFileSync(join(process.cwd(),p), "utf8");
    expect(load("src/app/meals/actions.ts")).toContain("analysis_snapshot:");
    expect(load("src/components/advanced-nutrients-summary.tsx")).toContain("available");
    expect(load("src/components/meal-editor.tsx")).toContain("addedSugarG:f.advancedNutrients");
    expect(load("src/components/barcode-lookup.tsx")).not.toContain('["Added sugar","addedSugarG","g"]');
    expect(load("src/components/meal-advanced-nutrients-summary.tsx")).toContain("will be saved with Add Meal");
  });
});
