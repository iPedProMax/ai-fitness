import type { createClient } from "@/lib/supabase/server";

export type MealHistoryMode = "recent" | "week" | "month" | "date" | "range";
export type MealHistoryView = {
  mode: MealHistoryMode;
  term: string;
  date: string;
  from: string;
  to: string;
  days: number;
};
type Params = Record<string, string | string[] | undefined>;
function scalar(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
export function isCalendarDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseMealHistoryView(params: Params): MealHistoryView {
  const modeValue = scalar(params.period);
  const mode: MealHistoryMode = ["recent", "week", "month", "date", "range"].includes(modeValue)
    ? modeValue as MealHistoryMode : "recent";
  const daysRaw = scalar(params.days);
  const days = /^[1-9]\d{0,1}$/.test(daysRaw) ? Math.min(60, Math.max(3, Number(daysRaw))) : 3;
  return {
    mode,
    term: scalar(params.q).trim().slice(0, 80),
    date: isCalendarDate(scalar(params.date)) ? scalar(params.date) : "",
    from: isCalendarDate(scalar(params.from)) ? scalar(params.from) : "",
    to: isCalendarDate(scalar(params.to)) ? scalar(params.to) : "",
    days,
  };
}

const manilaParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});
const manilaDateLabel = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric", year: "numeric",
});
const manilaClock = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true,
});
export function philippinesDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  const parts = manilaParts.formatToParts(date);
  const take = (part: string) => parts.find(p => p.type === part)?.value ?? "";
  return `${take("year")}-${take("month")}-${take("day")}`;
}
export function philippinesDayLabel(isoDate: string): string {
  if (!isCalendarDate(isoDate)) return "Unknown date";
  return manilaDateLabel.format(new Date(`${isoDate}T12:00:00+08:00`));
}
export function philippinesMealClock(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";
  return manilaClock.format(new Date(value));
}
function shiftCalendarDay(day: string, offset: number): string {
  const utc = new Date(`${day}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}
export function dateBoundaries(view: MealHistoryView, now = new Date()): { start?: string; end?: string } {
  const today = philippinesDay(now);
  let start = ""; let end = "";
  if (view.mode === "week") start = shiftCalendarDay(today, -6);
  if (view.mode === "month") start = shiftCalendarDay(today, -29);
  if (view.mode === "date") {
    if (!view.date) return {};
    start = view.date; end = view.date;
  }
  if (view.mode === "range") {
    if (!view.from || !view.to || view.from > view.to) return {};
    // A bounded custom range avoids unbounded expensive searches.
    const span = (Date.parse(view.to + "T00:00:00Z") - Date.parse(view.from + "T00:00:00Z")) / 86400000;
    if (span > 366) return {};
    start = view.from; end = view.to;
  }
  return {
    ...(start ? { start: `${start}T00:00:00+08:00` } : {}),
    ...(end ? { end: `${shiftCalendarDay(end, 1)}T00:00:00+08:00` } : {}),
  };
}
export function mealHistoryHref(view: MealHistoryView, overrides: Partial<MealHistoryView> = {}): string {
  const next = { ...view, ...overrides };
  const params = new URLSearchParams();
  if (next.term) params.set("q", next.term);
  if (next.mode !== "recent") params.set("period", next.mode);
  if (next.mode === "date" && next.date) params.set("date", next.date);
  if (next.mode === "range") {
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
  }
  if (next.days > 3) params.set("days", String(next.days));
  const query = params.toString();
  return query ? `/meals?${query}` : "/meals";
}

type MealRowIndex = { id: string; consumed_at: string | null; created_at: string };
export type MealBrowseResult = { ids: string[]; hasMore: boolean; truncated: boolean; error: boolean };
/** Read only the index of matching meals, until the desired number of distinct logged days is located.
 * Never fetches every user's history or any other user's rows. */
export async function browseMealIds(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string, view: MealHistoryView,
): Promise<MealBrowseResult> {
  const empty: MealBrowseResult = { ids: [], hasMore: false, truncated: false, error: false };
  if ((view.mode === "date" && !view.date) ||
      (view.mode === "range" && (!view.from || !view.to || view.from > view.to ||
       (Date.parse(view.to + "T00:00:00Z") - Date.parse(view.from + "T00:00:00Z")) / 86400000 > 366))) return empty;
  const limits = dateBoundaries(view);
  const found: MealRowIndex[] = [];
  const seenDays = new Set<string>();
  const batchSize = 150;
  const maxScanned = 2400;
  let hasMore = false;
  let finished = false;
  for (let offset = 0; offset < maxScanned && !finished; offset += batchSize) {
    // The inner join searches the database (not just the currently displayed page).
    const columns = view.term
      ? "id, consumed_at, created_at, meal_items!inner(name)"
      : "id, consumed_at, created_at";
    let query = supabase.from("meals").select(columns)
      .eq("user_id", userId)
      .order("consumed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (limits.start) query = query.gte("consumed_at", limits.start);
    if (limits.end) query = query.lt("consumed_at", limits.end);
    if (view.term) {
      // Treat wildcard characters literally in the user-facing search field.
      const needle = view.term.replace(/[\\%_]/g, "\\$&");
      query = query.ilike("meal_items.name", `%${needle}%`);
    }
    const { data, error } = await query;
    if (error) return { ...empty, error: true };
    const rows = (data ?? []) as unknown as MealRowIndex[];
    for (const row of rows) {
      if (!row || typeof row.id !== "string") continue;
      const day = philippinesDay(row.consumed_at ?? row.created_at);
      if (!day) continue;
      if (!seenDays.has(day) && seenDays.size >= view.days) {
        hasMore = true; finished = true; break;
      }
      seenDays.add(day);
      found.push(row);
    }
    if (rows.length < batchSize) finished = true;
  }
  return {
    ids: found.map(row => row.id), hasMore,
    truncated: !finished, error: false,
  };
}
export function groupMealHistory<T extends { id: string; consumed_at: string | null; created_at: string; total_calories: number }>(meals: T[]): Array<{ day: string; label: string; meals: T[]; calories: number }> {
  const groups = new Map<string, T[]>();
  for (const meal of meals) {
    const day = philippinesDay(meal.consumed_at ?? meal.created_at);
    if (!day) continue;
    const list = groups.get(day) ?? [];
    list.push(meal);
    groups.set(day, list);
  }
  return [...groups.entries()].map(([day, entries]) => ({
    day, label: philippinesDayLabel(day), meals: entries,
    calories: entries.reduce((sum, meal) => sum + (Number.isFinite(Number(meal.total_calories)) ? Number(meal.total_calories) : 0), 0),
  }));
}
