import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatReportDate } from "./report-date-format";

describe("Reports Daily date formatting runtime regression", () => {
  it("formats a Manila Monday with a weekday and year without throwing", () => {
    const formatted = formatReportDate("2026-11-02");
    expect(formatted).toMatch(/Mon/);
    expect(formatted).toMatch(/Nov/);
    expect(formatted).toMatch(/2026/);
  });
  it("uses the calendar date supplied for the Daily tab", () => {
    expect(formatReportDate("2026-11-01")).toMatch(/Sun/);
    expect(formatReportDate("2026-11-02")).toMatch(/Mon/);
  });
  it("renders using the tested formatter, not the invalid dateStyle + weekday pair", () => {
    const component = readFileSync(join(process.cwd(), "src/components/reports-daily-view.tsx"), "utf8");
    expect(component).toContain("formatReportDate(day.date)");
    expect(component).not.toContain('dateStyle: "medium", weekday: "short"');
  });
});
