import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createWeeklyReport } from "./weekly-report";
import { buildSevenDayChartModel } from "./report-chart-model";

const dates = ["2026-10-31", "2026-11-01", "2026-11-02"];
function meal(id: string, date: string, calories: number) {
  return { id, consumed_at: `${date}T12:00:00+08:00`, total_calories: calories,
    total_protein: 20, total_carbs: 30, total_fat: 10,
    analysis_snapshot: { foods: [{ unknownMacros: [] }] } };
}

describe("Phase V2 daily report chart", () => {
  it("distinguishes never logged from a saved zero-calorie entry", () => {
    const report = createWeeklyReport([meal("zero", dates[0], 0)], dates);
    const model = buildSevenDayChartModel(report, null);
    expect(model.days[0]).toMatchObject({ hasLog: true, caloriesLabel: "0 kcal", heightPercent: 0 });
    expect(model.days[1]).toMatchObject({ hasLog: false, caloriesLabel: "No log", heightPercent: 0 });
    expect(model.days[2]).toMatchObject({ hasLog: false, caloriesLabel: "No log" });
  });
  it("preserves the recorded nutrition while normalizing bar heights", () => {
    const report = createWeeklyReport([meal("a", dates[0], 500), meal("b", dates[1], 1500)], dates);
    const model = buildSevenDayChartModel(report, 2000);
    expect(model.maximum).toBe(2000);
    expect(model.goal).toBe(2000);
    expect(model.days[0].heightPercent).toBe(25);
    expect(model.days[1].heightPercent).toBe(75);
    expect(model.days[0].calories).toBe(500);
    expect(model.days[1].calories).toBe(1500);
  });
  it("scales charts to logged amounts above the target rather than clipping bars", () => {
    const report = createWeeklyReport([meal("a", dates[0], 3000)], dates);
    const model = buildSevenDayChartModel(report, 2000);
    expect(model.maximum).toBe(3000);
    expect(model.days[0].heightPercent).toBe(100);
  });
  it("ignores nonpositive and invalid target values", () => {
    const report = createWeeklyReport([meal("a", dates[0], 100)], dates);
    expect(buildSevenDayChartModel(report, 0).goal).toBeNull();
    expect(buildSevenDayChartModel(report, Number.NaN).goal).toBeNull();
    expect(buildSevenDayChartModel(report, null).goal).toBeNull();
  });
  it("maintains a readable 4 percent bar for small positive logged values", () => {
    const report = createWeeklyReport([meal("small", dates[0], 1)], dates);
    const model = buildSevenDayChartModel(report, 2000);
    expect(model.days[0].heightPercent).toBe(4);
  });
  it("keeps V1 summary, report table, and authentication; does not call any AI", () => {
    const page = readFileSync(join(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    const chart = readFileSync(join(process.cwd(), "src/components/reports-interactive-chart.tsx"), "utf8");
    expect(page).toContain("<ReportsSevenDayOverview");
    expect(page).toContain("<ReportsInteractiveChart");
    expect(page).toContain("Not logged");
    expect(page).toContain("supabase.auth.getUser()");
    expect(chart).toContain('aria-pressed={selected}');
    expect(chart).toContain('aria-live="polite"');
    expect(chart).not.toMatch(/fetch\(|reserveAiUsage|generate\(/);
  });
});