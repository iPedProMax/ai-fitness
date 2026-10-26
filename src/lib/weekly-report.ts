import { manilaDateKey } from "@/lib/fitness-goals";
import { summarizeDailyNutrition, type DailyMealRecord } from "@/lib/daily-nutrition";

export type DatedMeal = DailyMealRecord & { consumed_at: string };

export function recentManilaDays(now: Date = new Date(), count = 7): string[] {
  const lastDay = manilaDateKey(now);
  const anchor = new Date(`${lastDay}T12:00:00+08:00`);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(anchor);
    day.setUTCDate(day.getUTCDate() - (count - i - 1));
    return manilaDateKey(day);
  });
}

export function createWeeklyReport(meals: DatedMeal[], dates: string[]) {
  return dates.map(date => {
    const sameDay = meals.filter(meal => {
      const when = new Date(meal.consumed_at);
      return !Number.isNaN(when.valueOf()) && manilaDateKey(when) === date;
    });
    return { date, ...summarizeDailyNutrition(sameDay) };
  });
}
