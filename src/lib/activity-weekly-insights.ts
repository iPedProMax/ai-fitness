import { manilaDayKey } from "./activity";
import { recentManilaDays } from "./weekly-report";

/** The list is bounded by the Activities page's existing 100-row query. */
export type WeeklyActivityRecord = {
  performed_at: string;
  duration_minutes: number | string | null;
  calories_burned: number | string | null;
  calorie_source?: string | null;
};

export type ActivityDayInsight = {
  date: string;
  sessions: number;
  minutes: number;
  knownCalories: number;
  missingCalorieCount: number;
};

export type ActivityWeekInsight = {
  days: ActivityDayInsight[];
  sessions: number;
  minutes: number;
  activeLoggedDays: number;
  knownCalories: number;
  missingCalorieCount: number;
};

function nonNegativeNumber(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Uses Philippine calendar dates. No record on a day means "not logged", not "inactive". */
export function summarizeActivityWeek(
  activities: readonly WeeklyActivityRecord[],
  now: Date = new Date(),
): ActivityWeekInsight {
  const days: ActivityDayInsight[] = recentManilaDays(now).map(date => ({
    date, sessions: 0, minutes: 0, knownCalories: 0, missingCalorieCount: 0,
  }));
  const byDay = new Map(days.map(day => [day.date, day]));
  for (const activity of activities) {
    const instant = new Date(activity.performed_at);
    if (!Number.isFinite(instant.getTime())) continue;
    const day = byDay.get(manilaDayKey(instant));
    if (!day) continue;
    day.sessions += 1;
    day.minutes += nonNegativeNumber(activity.duration_minutes) ?? 0;
    const kcal = nonNegativeNumber(activity.calories_burned);
    if (kcal === null) day.missingCalorieCount += 1;
    else day.knownCalories += kcal;
  }
  return {
    days,
    sessions: days.reduce((sum, day) => sum + day.sessions, 0),
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    activeLoggedDays: days.filter(day => day.sessions > 0).length,
    knownCalories: days.reduce((sum, day) => sum + day.knownCalories, 0),
    missingCalorieCount: days.reduce((sum, day) => sum + day.missingCalorieCount, 0),
  };
}