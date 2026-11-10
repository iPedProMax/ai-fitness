import { ACTIVITY_LABELS, type ActivityType, type CalorieSource, type Intensity, manilaDayKey } from "./activity";
import { recentManilaDays } from "./weekly-report";

export type ActivityHistoryRecord = {
  id: string;
  activity_type: ActivityType;
  intensity: string;
  duration_minutes: number | string;
  calories_burned: number | string | null;
  calorie_source: CalorieSource;
  performed_at: string;
  notes: string | null;
};

export type HistoryPeriod = "all" | "7" | "30";
export type ActivityHistoryFilters = {
  query: string;
  activityType: ActivityType | "all";
  period: HistoryPeriod;
};

/** Read-only filtering over the 100 latest saved activities, not all lifetime entries. */
export function filterActivityHistory(
  records: readonly ActivityHistoryRecord[],
  filters: ActivityHistoryFilters,
  now: Date = new Date(),
): ActivityHistoryRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const firstDay = filters.period === "all"
    ? null
    : recentManilaDays(now, Number(filters.period))[0];
  return records.filter(record => {
    if (filters.activityType !== "all" && record.activity_type !== filters.activityType) return false;
    const parsed = new Date(record.performed_at);
    if (!Number.isFinite(parsed.getTime())) return false;
    if (firstDay && manilaDayKey(parsed) < firstDay) return false;
    if (!query) return true;
    const searchable = [ACTIVITY_LABELS[record.activity_type] ?? "", record.intensity, record.notes ?? ""]
      .join(" ").toLocaleLowerCase();
    return searchable.includes(query);
  });
}

export const WORKOUT_PRESETS: readonly {
  id: string;
  label: string;
  activityType: ActivityType;
  intensity: Intensity;
  durationMinutes: number;
}[] = [
  { id: "walk", label: "Walk · 30 min", activityType: "walking", intensity: "moderate", durationMinutes: 30 },
  { id: "run", label: "Run · 20 min", activityType: "running", intensity: "moderate", durationMinutes: 20 },
  { id: "cycle", label: "Cycle · 30 min", activityType: "cycling", intensity: "moderate", durationMinutes: 30 },
  { id: "gym", label: "Gym · 45 min", activityType: "strength_training", intensity: "moderate", durationMinutes: 45 },
];

/** Keep the same PH date boundaries used by the weekly activity overview. */
export function groupActivityHistoryByDay(records: readonly ActivityHistoryRecord[]) {
  const groups = new Map<string, ActivityHistoryRecord[]>();
  for (const record of records) {
    const parsed = new Date(record.performed_at);
    if (!Number.isFinite(parsed.getTime())) continue;
    const date = manilaDayKey(parsed);
    const group = groups.get(date) ?? [];
    group.push(record);
    groups.set(date, group);
  }
  return Array.from(groups, ([date, entries]) => ({ date, entries }))
    .sort((a, b) => b.date.localeCompare(a.date));
}