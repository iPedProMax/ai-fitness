import { manilaDateKey } from "./fitness-goals";
import type { DatedMeal } from "./weekly-report";

export type ReportView = "daily" | "weekly";

/** Keep the existing seven-day experience as the default Reports view. */
export function resolveReportView(value: string | undefined): ReportView {
  return value === "daily" ? "daily" : "weekly";
}

/** Never trust a URL to request a date outside the seven days already queried. */
export function resolveReportDate(dates: readonly string[], candidate: string | undefined): string {
  if (dates.length === 0) return "";
  return candidate && dates.includes(candidate) ? candidate : dates[dates.length - 1];
}

/** Uses Philippine midnight, not local browser/server midnight. */
export function mealsForReportDay(meals: readonly DatedMeal[], date: string): DatedMeal[] {
  return meals.filter(meal => {
    const at = new Date(meal.consumed_at);
    return Number.isFinite(at.valueOf()) && manilaDateKey(at) === date;
  });
}