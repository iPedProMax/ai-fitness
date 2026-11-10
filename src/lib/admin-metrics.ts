import "server-only";
import { createClient as trustedClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { countByManilaDay, lastSevenManilaDays } from "@/lib/admin-daily-trends";

export type AdminSeries = { day: string; meals: number; activities: number };
export type AdminSummary = {
  status: "ready" | "not_configured";
  users: number | null; recentSignups: number | null;
  meals: number | null; recentMeals: number | null;
  activities: number | null; recentActivities: number | null;
  daily: AdminSeries[] | null;
  notes: string[]; generatedAt: string;
};

/** Called ONLY on the server, AFTER an independently verified admin gate. */
export async function readAdminSummary(): Promise<AdminSummary> {
  // Defense in depth: future callers cannot bypass page-level authorization.
  const access = await getAdminAccess();
  if (!access.isAdmin) throw new Error("Admin authorization required");
  const generatedAt = new Date().toISOString();
  const days = lastSevenManilaDays(new Date(generatedAt));
  const start = `${days[0]}T00:00:00+08:00`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {
    status: "not_configured", users: null, recentSignups: null,
    meals: null, recentMeals: null, activities: null, recentActivities: null,
    daily: null, notes: ["Trusted server-side analytics key is not configured."], generatedAt,
  };

  // Never use the SSR cookie client for service-role reads. Never expose the key.
  const client = trustedClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const countRows = async (table: "meals" | "activities", timeField?: "consumed_at" | "performed_at") => {
    let query = client.from(table).select("id", { head: true, count: "exact" });
    if (timeField) query = query.gte(timeField, start);
    const { count, error } = await query;
    return !error && typeof count === "number" ? count : null;
  };
  // Count queries return only aggregate numbers, not private meal records.
  const [auth, meals, recentMeals, activities, recentActivities, mealEvents, activityEvents] = await Promise.allSettled([
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    countRows("meals"), countRows("meals", "consumed_at"),
    countRows("activities"), countRows("activities", "performed_at"),
    client.from("meals").select("consumed_at").gte("consumed_at", start)
      .order("consumed_at", { ascending: false }).limit(501),
    client.from("activities").select("performed_at").gte("performed_at", start)
      .order("performed_at", { ascending: false }).limit(501),
  ] as const);
  const value = <T,>(result: PromiseSettledResult<T>): T | null => result.status === "fulfilled" ? result.value : null;
  const authResult = value(auth);
  const notes: string[] = [];
  let users: number | null = null;
  let recentSignups: number | null = null;
  if (authResult && !authResult.error) {
    const page = authResult.data;
    const isPartial = page.users.length === 1000 || ("nextPage" in page && page.nextPage != null);
    // The Auth admin API may provide a full total separate from its first user page.
    users = typeof page.total === "number" && page.total > 0 ? page.total : isPartial ? null : page.users.length;
    if (!isPartial) recentSignups = page.users.filter(user =>
      !!user.created_at && new Date(user.created_at).getTime() >= new Date(start).getTime()).length;
    else notes.push("Recent signups are unavailable above the 1,000-account sample limit.");
  } else notes.push("Registration metrics unavailable from Supabase Auth.");
  const mealCount = value(meals); const weekMealCount = value(recentMeals);
  const activityCount = value(activities); const weekActivityCount = value(recentActivities);
  for (const [label, count] of [["Meals", mealCount], ["Recent meals", weekMealCount], ["Activities", activityCount], ["Recent activities", weekActivityCount]] as const)
    if (count === null) notes.push(`${label} count unavailable; database configuration may need review.`);
  const mealRows = value(mealEvents); const activityRows = value(activityEvents);
  let daily: AdminSeries[] | null = null;
  if (mealRows && !mealRows.error && activityRows && !activityRows.error &&
      mealRows.data && activityRows.data && mealRows.data.length < 501 && activityRows.data.length < 501) {
    const mealCounts = countByManilaDay(mealRows.data.map(item => item.consumed_at).filter((s): s is string => typeof s === "string"), days);
    const activityCounts = countByManilaDay(activityRows.data.map(item => item.performed_at).filter((s): s is string => typeof s === "string"), days);
    daily = days.map((day, i) => ({ day, meals: mealCounts[i], activities: activityCounts[i] }));
  } else notes.push("Seven-day chart unavailable or over the 500-entry display limit; total counters are counted separately.");
  return {
    status: "ready", users, recentSignups, meals: mealCount,
    recentMeals: weekMealCount, activities: activityCount, recentActivities: weekActivityCount,
    daily, notes, generatedAt,
  };
}
