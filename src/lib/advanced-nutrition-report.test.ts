import { describe, expect, it } from "vitest";
import { buildAdvancedNutritionReport, completenessLabel, formatRecordedNutrient, sumRecordedNutrient } from "./advanced-nutrition-report";

const dates = ["2026-10-31", "2026-11-01", "2026-11-02"];
const sample = [
  { consumed_at: "2026-10-31T16:30:00Z", analysis_snapshot: { foods: [
    { advancedNutrients: { fiberG: 2, sugarG: 0, sodiumMg: 210 } },
    { advancedNutrients: { fiberG: 1, saturatedFatG: 1.2 } },
  ] } },
  { consumed_at: "2026-11-01T16:00:00Z", analysis_snapshot: { foods: [
    { advancedNutrients: { fiberG: 3, sugarG: 8, sodiumMg: 500 } },
  ] } },
  { consumed_at: "2026-11-01T17:00:00Z", analysis_snapshot: null },
];

describe("Advanced nutrient report: recorded values versus unknowns", () => {
  it("groups meals by Philippine date and distinguishes no-log days", () => {
    const report = buildAdvancedNutritionReport(sample, dates);
    expect(report.map(day => day.mealCount)).toEqual([0, 1, 2]);
    expect(report[0].nutrients.sugarG.known).toBe(0);
    expect(report[0].nutrients.sugarG.missing).toBe(0);
  });
  it("preserves real zero sugar, marks missing values and never treats them as zero", () => {
    const report = buildAdvancedNutritionReport(sample, dates);
    expect(report[1].nutrients.sugarG).toEqual({ total: 0, known: 1, missing: 1 });
    expect(formatRecordedNutrient(report[1].nutrients.sugarG, "sugarG")).toBe("0 g+");
    expect(completenessLabel(report[1].nutrients.sugarG)).toBe("1 of 2 foods recorded");
    expect(report[2].nutrients.sodiumMg).toEqual({ total: 500, known: 1, missing: 1 });
    expect(formatRecordedNutrient(report[2].nutrients.sodiumMg, "sodiumMg")).toBe("500 mg+");
  });
  it("preserves weekly coverage, with 0 known flagged Unknown", () => {
    const report = buildAdvancedNutritionReport(sample, dates);
    expect(sumRecordedNutrient(report, "fiberG")).toEqual({ total: 6, known: 3, missing: 1 });
    expect(sumRecordedNutrient(report, "saturatedFatG")).toEqual({ total: 1.2, known: 1, missing: 3 });
    expect(formatRecordedNutrient({ total: 0, known: 0, missing: 2 }, "fiberG")).toBe("Unknown");
    expect(formatRecordedNutrient({ total: 0, known: 1, missing: 0 }, "sodiumMg")).toBe("0 mg");
  });
  it("ignores non-object advanced nutrient payloads without inventing zeros", () => {
    const report = buildAdvancedNutritionReport([{
      consumed_at: "2026-11-01T18:00:00Z",
      analysis_snapshot: { foods: [
        { advancedNutrients: [15, 20] },
        { advancedNutrients: "not-structured" },
        { advancedNutrients: { sugarG: 0 } },
      ] },
    }], dates);
    expect(report[2].nutrients.sugarG).toEqual({ total: 0, known: 1, missing: 2 });
    expect(formatRecordedNutrient(report[2].nutrients.sugarG, "sugarG")).toBe("0 g+");
  });
  it("excludes invalid timestamps and values without crashing", () => {
    const report = buildAdvancedNutritionReport([
      { consumed_at: "invalid", analysis_snapshot: { foods: [{ advancedNutrients: { sugarG: 999 } }] } },
      { consumed_at: "2026-11-02T02:00:00Z", analysis_snapshot: { foods: [{ advancedNutrients: { sugarG: Number.NaN } }] } },
    ], dates);
    expect(report[2].mealCount).toBe(1);
    expect(report[2].nutrients.sugarG).toEqual({ total: 0, known: 0, missing: 1 });
  });
  it("does not duplicate extra dates and ignores meals outside the seven-day reporting window", () => {
    const report = buildAdvancedNutritionReport([{ consumed_at: "2026-10-29T06:00:00Z" }], dates);
    expect(report.every(day => day.mealCount === 0)).toBe(true);
  });
});