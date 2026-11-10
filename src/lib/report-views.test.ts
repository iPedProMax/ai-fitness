import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mealsForReportDay, resolveReportDate, resolveReportView } from "./report-views";
import type { DatedMeal } from "./weekly-report";

function meal(id: string, consumed_at: string): DatedMeal {
  return { id, consumed_at, total_calories: 100, total_protein: 5, total_carbs: 10, total_fat: 2 };
}

describe("Phase V3 daily and weekly reporting", () => {
  it("retains the existing weekly view unless daily is explicitly selected", () => {
    expect(resolveReportView(undefined)).toBe("weekly");
    expect(resolveReportView("weekly")).toBe("weekly");
    expect(resolveReportView("daily")).toBe("daily");
    expect(resolveReportView("unexpected")).toBe("weekly");
  });
  it("allows selection only from dates actually included in the report", () => {
    const dates = ["2026-10-31", "2026-11-01", "2026-11-02"];
    expect(resolveReportDate(dates, "2026-10-31")).toBe("2026-10-31");
    expect(resolveReportDate(dates, "2026-12-30")).toBe("2026-11-02");
    expect(resolveReportDate(dates, undefined)).toBe("2026-11-02");
    expect(resolveReportDate([], "2026-11-02")).toBe("");
  });
  it("groups meals by Philippine date at the UTC midnight boundary", () => {
    const saved = [
      meal("before", "2026-11-01T15:59:59.000Z"),
      meal("after", "2026-11-01T16:00:00.000Z"),
      meal("bad", "invalid timestamp"),
    ];
    expect(mealsForReportDay(saved, "2026-11-01").map(m => m.id)).toEqual(["before"]);
    expect(mealsForReportDay(saved, "2026-11-02").map(m => m.id)).toEqual(["after"]);
  });
  it("renames the navigation and preserves authenticated weekly data and V2 chart", () => {
    const root = process.cwd();
    const page = readFileSync(join(root, "src/app/reports/page.tsx"), "utf8");
    const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
    const daily = readFileSync(join(root, "src/components/reports-daily-view.tsx"), "utf8");
    expect(page).toContain("resolveReportView");
    expect(page).toContain('<ReportsDailyView');
    expect(page).toContain('<ReportsSevenDayOverview');
    expect(page).toContain('<ReportsInteractiveChart');
    expect(page).toContain('supabase.auth.getUser()');
    expect(shell).not.toContain('label: "Daily Reports"');
    expect(shell).toContain('label: "Reports"');
    expect(shell.indexOf('label: "AI Coach"')).toBeGreaterThan(shell.indexOf('label: "Goals"'));
    expect(shell.indexOf('label: "AI Coach"')).toBeLessThan(shell.indexOf('label: "Settings"'));
    expect(shell).toContain('function CoachNavIcon()');
    expect(shell).toContain('item.href === "/coach" ? <CoachNavIcon />');
    expect(daily).toContain('No meals logged for this day');
    expect(daily).not.toMatch(/fetch\(|reserveAiUsage|generate\(/);
  });
});