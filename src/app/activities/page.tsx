import { ActivityHistoryPanel } from "@/components/activity-history-panel";
import Link from "next/link";
import { ActivityWeekly } from "@/components/activity-weekly";
import { WatchCsvImport } from "@/components/watch-csv-import";
import { recentManilaDays } from "@/lib/weekly-report";
import { redirect } from "next/navigation";
import { ActivityForm } from "@/components/activity-form";
import { ActivityWeeklyOverview } from "@/components/activity-weekly-overview";
import { DeleteActivityButton } from "@/components/delete-activity-button";
import { ACTIVITY_LABELS, manilaDayKey, type ActivityType, type CalorieSource } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SavedActivity = {
  id: string;
  activity_type: ActivityType;
  intensity: string;
  duration_minutes: number;
  calories_burned: number | string | null;
  calorie_source: CalorieSource;
  performed_at: string;
  notes: string;
};

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view activities."));

  // Account preference only changes display; saved exercise data stays intact.
  const { data: preference, error: preferenceError } = await supabase.from("user_preferences")
    .select("show_exercise_calories")
    .eq("user_id", user.id)
    .maybeSingle();
  const showExerciseCalories = !preferenceError && preference?.show_exercise_calories === true;

  // RLS ensures only the logged-in user's records are returned.
  const { data, error } = await supabase.from("activities")
    .select("id, activity_type, intensity, duration_minutes, calories_burned, calorie_source, performed_at, notes")
    .eq("user_id", user.id)
    .order("performed_at", { ascending: false })
    .limit(100);
  const activities = (data ?? []) as SavedActivity[];
  const weekDays = recentManilaDays();
  const weeklyResult = await supabase.from("activities")
    .select("performed_at,duration_minutes,calories_burned")
    .eq("user_id",user.id).gte("performed_at",`${weekDays[0]}T00:00:00+08:00`)
    .order("performed_at",{ascending:false}).limit(500);
  const weeklyDays = weekDays.map(date => {
    const matching = (weeklyResult.data ?? []).filter(row => manilaDayKey(new Date(row.performed_at)) === date);
    return {date,logs:matching.length,minutes:matching.reduce((sum,row)=>sum+Number(row.duration_minutes),0),calories:matching.reduce((sum,row)=>sum+Number(row.calories_burned ?? 0),0)};
  });
  const today = manilaDayKey(new Date());
  const todayActivities = activities.filter((item) => manilaDayKey(new Date(item.performed_at)) === today);
  const todayMinutes = todayActivities.reduce((sum, item) => sum + Number(item.duration_minutes), 0);
  const todayCalories = todayActivities.reduce((sum, item) => sum + Number(item.calories_burned ?? 0), 0);

  return (
    <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Move at your pace</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Exercise & Activities</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Track your workouts without using AI credits. Calorie numbers are optional in Settings.</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700">Manual logging · Free</span>
        </div>

        <section aria-label="Today's activities" className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Activities today", value: todayActivities.length.toLocaleString(), unit: "logs" },
            { label: "Time moving today", value: todayMinutes.toLocaleString(), unit: "min" },
            ...(showExerciseCalories ? [{ label: "Recorded burn today", value: Math.round(todayCalories).toLocaleString(), unit: "kcal" }] : []),
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
              <div className="mt-3 flex items-baseline gap-2"><span className="text-2xl font-extrabold">{stat.value}</span><span className="text-xs font-semibold text-slate-500">{stat.unit}</span></div>
            </div>
          ))}
        </section>
        <p className="mt-2 text-xs text-slate-500">Today uses Philippine time. Totals are based on the 100 most recent logs. {showExerciseCalories ? "Burn values are user-reported or approximate gross estimates, never automatically subtracted from food intake." : "Calorie-burn numbers are hidden. You can change this in Settings."}</p>
        <Link href="/settings" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">Change exercise display settings →</Link>
        {preferenceError && <p role="alert" className="mt-3 block text-xs text-red-700">Could not load display preferences. Check the user preferences migration in Supabase.</p>}

        {!weeklyResult.error ? <ActivityWeekly days={weeklyDays} showExerciseCalories={showExerciseCalories} truncated={(weeklyResult.data ?? []).length >= 500} /> : <p role="alert" className="mt-4 text-sm text-red-700">Could not load your weekly activity summary.</p>}
        <WatchCsvImport />
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <ActivityWeeklyOverview activities={activities} now={new Date()} showExerciseCalories={showExerciseCalories} truncated={activities.length >= 100} loadFailed={Boolean(error)} />
          <ActivityForm showExerciseCalories={showExerciseCalories} />
          <ActivityHistoryPanel activities={activities} showExerciseCalories={showExerciseCalories} loadFailed={Boolean(error)} nowIso={new Date().toISOString()} />
        </div>
      </div>
    </main>
  );
}
