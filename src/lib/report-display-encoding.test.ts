import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
const pages = [
  "src/app/reports/page.tsx",
  "src/components/reports-interactive-chart.tsx",
  "src/components/reports-seven-day-overview.tsx",
  "src/components/reports-daily-view.tsx",
];
describe("Reports text encoding regression", () => {
  it("renders readable chart title and empty-day punctuation", () => {
    const src = read("src/components/reports-interactive-chart.tsx");
    expect(src).toContain("Calories logged \u2014 last 7 days");
    expect(src).toContain('day.hasLog ? readable(day.calories) : "\u2014"');
  });
  it("renders readable action arrows", () => {
    const src = read("src/components/reports-interactive-chart.tsx");
    expect(src).toContain("Log food \u2192");
  });
  it("contains no Windows-1252 mojibake in report UI sources", () => {
    for (const page of pages) {
      const src = read(page);
      expect(src, page).not.toMatch(/[\u00e2][\u20ac\u0080\u2020\u2018\u2019\u201c\u201d]/u);
      expect(src, page).not.toMatch(/\u00c2[\u00a0-\u00bf]/u);
    }
  });
});
