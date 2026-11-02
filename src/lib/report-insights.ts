import type { createWeeklyReport } from "./weekly-report";

type ReportDay = ReturnType<typeof createWeeklyReport>[number];

export type SevenDayOverview = {
  calendarDays: number;
  daysWithMeals: number;
  daysWithoutMeals: number;
  mealCount: number;
  loggedCalories: number;
  averageCaloriesOnLoggedDays: number | null;
  averageProteinOnLoggedDays: number | null;
  daysWithIncompleteMacros: number;
  todayHasMeals: boolean;
  todayCalories: number | null;
};

/** A missing log is unknown intake, never evidence that a person ate zero. */
export function summarizeSevenDayOverview(days: readonly ReportDay[]): SevenDayOverview {
  const logged = days.filter(day => day.mealCount > 0);
  const mealCount = logged.reduce((sum, day) => sum + day.mealCount, 0);
  const loggedCalories = logged.reduce((sum, day) => sum + day.calories, 0);
  const completeProtein = logged.length > 0 && logged.every(day =>
    !day.protein.incomplete && day.protein.anyKnown);
  const daysWithIncompleteMacros = logged.filter(day =>
    day.protein.incomplete || day.carbs.incomplete || day.fat.incomplete).length;
  const today = days.at(-1);
  return {
    calendarDays: days.length,
    daysWithMeals: logged.length,
    daysWithoutMeals: days.length - logged.length,
    mealCount,
    loggedCalories,
    averageCaloriesOnLoggedDays: logged.length ? loggedCalories / logged.length : null,
    averageProteinOnLoggedDays: completeProtein
      ? logged.reduce((sum, day) => sum + day.protein.grams, 0) / logged.length : null,
    daysWithIncompleteMacros,
    todayHasMeals: Boolean(today && today.mealCount > 0),
    todayCalories: today && today.mealCount > 0 ? today.calories : null,
  };
}