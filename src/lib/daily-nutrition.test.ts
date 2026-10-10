import { describe, expect, it } from "vitest";
import {
  displayMacro,
  localDayWindow,
  summarizeDailyNutrition,
  type DailyMealRecord,
} from "./daily-nutrition";

function meal(overrides: Partial<DailyMealRecord> = {}): DailyMealRecord {
  return {
    id: "meal-1",
    total_calories: 260,
    total_protein: 5,
    total_carbs: 57,
    total_fat: 1,
    ...overrides,
  };
}

describe("daily nutrition totals", () => {
  it("shows zero totals when the user has logged no meals", () => {
    const summary = summarizeDailyNutrition([]);
    expect(summary.calories).toBe(0);
    expect(displayMacro(summary.protein, 0)).toBe("0 g");
    expect(summary.mealCount).toBe(0);
  });

  it("adds calories and recorded macros across meals", () => {
    const summary = summarizeDailyNutrition([
      meal(),
      meal({ id: "meal-2", total_calories: 120, total_protein: 8, total_carbs: 10, total_fat: 5 }),
    ]);
    expect(summary.calories).toBe(380);
    expect(displayMacro(summary.protein, summary.mealCount)).toBe("13 g");
    expect(displayMacro(summary.carbs, summary.mealCount)).toBe("67 g");
    expect(displayMacro(summary.fat, summary.mealCount)).toBe("6 g");
  });

  it("does not treat unknown manual macros as recorded zeroes", () => {
    const summary = summarizeDailyNutrition([meal({
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
      analysis_snapshot: {
        foods: [{ unknownMacros: ["protein", "carbs", "fat"] }],
      },
    })]);
    expect(summary.calories).toBe(260);
    expect(displayMacro(summary.protein, summary.mealCount)).toBe("Unknown");
    expect(displayMacro(summary.carbs, summary.mealCount)).toBe("Unknown");
    expect(displayMacro(summary.fat, summary.mealCount)).toBe("Unknown");
  });

  it("reports a partial known macro total without claiming it is complete", () => {
    const summary = summarizeDailyNutrition([
      meal({ analysis_snapshot: { foods: [{ unknownMacros: ["protein"] }] }, total_protein: 0 }),
      meal({ id: "meal-2", total_calories: 50, total_protein: 12 }),
    ]);
    expect(summary.calories).toBe(310);
    expect(summary.protein.incomplete).toBe(true);
    expect(displayMacro(summary.protein, summary.mealCount)).toBe("12 g+");
    expect(displayMacro(summary.carbs, summary.mealCount)).toBe("114 g");
  });

  it("treats a genuinely recorded zero as zero", () => {
    const summary = summarizeDailyNutrition([meal({
      total_fat: 0,
      analysis_snapshot: { foods: [{ unknownMacros: ["protein", "carbs"] }] },
    })]);
    expect(displayMacro(summary.fat, summary.mealCount)).toBe("0 g");
  });

  it("supports legacy meals without a nutrition snapshot", () => {
    const summary = summarizeDailyNutrition([meal({ analysis_snapshot: null })]);
    expect(displayMacro(summary.protein, summary.mealCount)).toBe("5 g");
  });

  it("uses the browser's local midnight boundaries", () => {
    const now = new Date(2026, 9, 9, 23, 45);
    const range = localDayWindow(now);
    expect(range.start).toBe(new Date(2026, 9, 9).toISOString());
    expect(range.end).toBe(new Date(2026, 9, 10).toISOString());
  });
});
