import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reportFoodRows, reportFoodWeight, reportMealTitle, reportNutrient, type ReportMeal } from "./report-meal-details";

const example: ReportMeal = {
  id: "saved-1", consumed_at: "2026-10-31T12:05:00Z",
  total_calories: 280, total_protein: 7, total_carbs: 46, total_fat: 5,
  notes: "A meal", meal_items: [
    { id: "rice", name: "White rice", estimated_grams: 150, calories: 200, protein: 3, carbs: 44, fat: 0.3 },
    { id: "egg", name: "Boiled egg", estimated_grams: 50, calories: 80, protein: 4, carbs: 2, fat: 4.7 },
  ],
  analysis_snapshot: { foods: [
    { name: "White rice", estimatedGrams: 150, calories: 190, unknownMacros: ["fat"] },
    { name: "Boiled egg", estimatedGrams: 50, calories: 70 },
  ] },
};

describe("Phase V4 daily saved-food breakdown", () => {
  it("uses current meal_items rather than stale snapshot nutrients", () => {
    const rows = reportFoodRows(example);
    expect(rows.map(x => x.name)).toEqual(["White rice", "Boiled egg"]);
    expect(rows.map(x => x.calories)).toEqual([200, 80]);
    expect(rows[0].source).toBe("saved_items");
  });
  it("carries unknown-macro flags and does not label placeholders zero", () => {
    const rice = reportFoodRows(example)[0];
    expect(rice.unknownMacros).toEqual(["fat"]);
    expect(reportNutrient(rice.fat, rice.unknownMacros.includes("fat"))).toBe("Unknown");
    expect(reportNutrient(0)).toBe("0 g");
    expect(reportNutrient(null)).toBe("Not provided");
  });
  it("falls back to saved snapshot for older rows without meal_items", () => {
    const rows = reportFoodRows({ ...example, meal_items: [] });
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("snapshot");
    expect(rows[0].name).toBe("White rice");
  });
  it("never invents food entries when both item rows and snapshot are absent", () => {
    const rows = reportFoodRows({ ...example, meal_items: null, analysis_snapshot: null });
    expect(rows).toEqual([]);
    expect(reportMealTitle(rows)).toContain("unavailable");
  });
  it("uses friendly names and does not present zero grams as measured weight", () => {
    expect(reportMealTitle(reportFoodRows(example))).toBe("White rice + Boiled egg");
    expect(reportFoodWeight({ ...reportFoodRows(example)[0], grams: 0 })).toBeNull();
    expect(reportFoodWeight(reportFoodRows(example)[0])).toContain("150 g");
  });
  it("does not assume a positional match for unknown macros when food order changes", () => {
    const swapped = { ...example, meal_items: [...example.meal_items!].reverse() };
    expect(reportFoodRows(swapped)[1].unknownMacros).toEqual(["fat"]);
  });
  it("keeps existing seven-day reports, selects one joined dataset and retains the date filter", () => {
    const page = readFileSync(join(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    const daily = readFileSync(join(process.cwd(), "src/components/reports-daily-view.tsx"), "utf8");
    const details = readFileSync(join(process.cwd(), "src/components/reports-daily-meal-details.tsx"), "utf8");
    expect(page).toContain("<ReportsSevenDayOverview");
    expect(page).toContain("<ReportsInteractiveChart");
    expect(page).toContain("meal_items(id,name,estimated_grams,calories,protein,carbs,fat)");
    expect(page).toContain("supabase.auth.getUser()");
    expect(daily).toContain("mealsForReportDay(meals, selectedDate)");
    expect(daily).toContain("<DailyMealDetails");
    expect(details).toContain("<details");
    expect(details).not.toMatch(/fetch\(|reserveAiUsage|generate\(/);
  });
});