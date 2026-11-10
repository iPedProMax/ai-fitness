import { describe, expect, it } from "vitest";
import { createWeeklyReport } from "./weekly-report";
import type { Macro } from "./daily-nutrition";
import { summarizeSevenDayOverview } from "./report-insights";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];
function meal(id: string, date: string, calories: number, protein: number, unknown: Macro[] = []) {
  return {
    id, consumed_at: `${date}T12:00:00+08:00`, total_calories: calories,
    total_protein: protein, total_carbs: 10, total_fat: 5,
    analysis_snapshot: { foods: [{ unknownMacros: unknown }] },
  };
}

describe("Phase V1 daily and weekly nutrition reporting", () => {
  it("does not treat missing-log days as zero-calorie days in averages", () => {
    const report = createWeeklyReport([
      meal("a", "2026-10-30", 400, 20), meal("b", "2026-11-01", 600, 30),
    ], days);
    const actual = summarizeSevenDayOverview(report);
    expect(actual).toMatchObject({ calendarDays: 4, daysWithMeals: 2, daysWithoutMeals: 2,
      mealCount: 2, loggedCalories: 1000, averageCaloriesOnLoggedDays: 500, averageProteinOnLoggedDays: 25 });
  });
  it("returns no averages when no meals are logged", () => {
    expect(summarizeSevenDayOverview(createWeeklyReport([], days))).toMatchObject({
      daysWithMeals: 0, daysWithoutMeals: 4, mealCount: 0,
      averageCaloriesOnLoggedDays: null, averageProteinOnLoggedDays: null, todayCalories: null,
    });
  });
  it("distinguishes an actual zero-calorie logged item from no entry", () => {
    const report = createWeeklyReport([meal("a", "2026-11-02", 0, 0)], days);
    expect(summarizeSevenDayOverview(report)).toMatchObject({
      daysWithMeals: 1, averageCaloriesOnLoggedDays: 0, todayHasMeals: true, todayCalories: 0,
    });
  });
  it("does not compute an average protein number when any logged day has unknown protein", () => {
    const report = createWeeklyReport([meal("a", "2026-10-30", 400, 20, ["protein"]), meal("b", "2026-11-02", 600, 30)], days);
    expect(summarizeSevenDayOverview(report)).toMatchObject({
      daysWithIncompleteMacros: 1, averageProteinOnLoggedDays: null,
      averageCaloriesOnLoggedDays: 500,
    });
  });
  it("ignores missing-day macro placeholders when detecting incomplete logged days", () => {
    const report = createWeeklyReport([meal("a", "2026-10-30", 400, 20)], days);
    expect(summarizeSevenDayOverview(report).daysWithIncompleteMacros).toBe(0);
  });
  it("identifies today separately from earlier logged days", () => {
    const report = createWeeklyReport([meal("a", "2026-10-30", 400, 20)], days);
    expect(summarizeSevenDayOverview(report)).toMatchObject({todayHasMeals:false,todayCalories:null});
  });
  it("uses the existing authenticated report page and does not add a provider call", () => {
    const page = readFileSync(join(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    const component = readFileSync(join(process.cwd(), "src/components/reports-seven-day-overview.tsx"), "utf8");
    expect(page).toContain("<ReportsSevenDayOverview");
    expect(page).toContain("Not logged");
    expect(component).toContain("No log does not mean you ate zero");
    expect(component).not.toMatch(/fetch\(|reserveAiUsage|generate\(/);
  });
});