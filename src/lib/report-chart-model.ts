import type { createWeeklyReport } from "./weekly-report";

type ReportDay = ReturnType<typeof createWeeklyReport>[number];

export type DayChartDatum = ReportDay & {
  hasLog: boolean;
  caloriesLabel: string;
  heightPercent: number;
};

export type SevenDayChartModel = {
  days: DayChartDatum[];
  goal: number | null;
  maximum: number;
};

/** Visualize only saved entries. Missing meal logs are not zero food intake. */
export function buildSevenDayChartModel(
  report: readonly ReportDay[],
  calorieTarget: number | null,
): SevenDayChartModel {
  const goal = typeof calorieTarget === "number" && Number.isFinite(calorieTarget) && calorieTarget > 0
    ? calorieTarget : null;
  const maximum = Math.max(1, goal ?? 0, ...report.filter(day => day.mealCount > 0).map(day => day.calories));
  return {
    goal,
    maximum,
    days: report.map(day => {
      const hasLog = day.mealCount > 0;
      return {
        ...day,
        hasLog,
        caloriesLabel: hasLog ? `${Math.round(day.calories).toLocaleString("en-PH")} kcal` : "No log",
        heightPercent: hasLog && day.calories > 0
          ? Math.min(100, Math.max(4, (day.calories / maximum) * 100)) : 0,
      };
    }),
  };
}