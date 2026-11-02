"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { localDayWindow, summarizeDailyNutrition, displayMacro, type DailyNutritionSummary, type DailyMealRecord } from "@/lib/daily-nutrition";

type RecentMeal = DailyMealRecord & { consumed_at: string; meal_items: { name: string }[] };
type GoalStatus = { status: "unset" | "error" } | { status: "ready"; calories: number; protein: number };
type ExerciseBurnState = { status: "hidden" | "error" } | { status: "ready"; calories: number; logs: number };
type DashboardState =
  | { status: "loading" | "guest" | "error" }
  | { status: "ready"; summary: DailyNutritionSummary; meals: RecentMeal[]; dateLabel: string; goals: GoalStatus; exercise: ExerciseBurnState };

const number = (n: number) => Math.round(n).toLocaleString();
const percent = (part: number, total: number) => total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0;

export function TodayOverview() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<"today" | "yesterday">("today");
  const refresh = useCallback(() => setRefreshKey(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading" });
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError) { setState({ status: "error" }); return; }
        if (!authData.user) { setState({ status: "guest" }); return; }
        // A local calendar day, not the midnight UTC day.
        const date = new Date();
        if (selectedDay === "yesterday") date.setDate(date.getDate() - 1);
        const today = localDayWindow(date);
        const { data, error } = await supabase.from("meals")
          .select("id,total_calories,total_protein,total_carbs,total_fat,analysis_snapshot,consumed_at,meal_items(name)")
          .eq("user_id", authData.user.id).gte("consumed_at", today.start).lt("consumed_at", today.end)
          .order("consumed_at", { ascending: false }).limit(100);
        if (cancelled) return;
        if (error) { setState({ status: "error" }); return; }
        const goalResult = await supabase.from("fitness_goals").select("calorie_target,protein_target")
          .eq("user_id", authData.user.id).maybeSingle();
        if (cancelled) return;
        const goals: GoalStatus = goalResult.error ? { status: "error" } : goalResult.data ? {
          status: "ready", calories: Number(goalResult.data.calorie_target), protein: Number(goalResult.data.protein_target)
        } : { status: "unset" };
        let exercise: ExerciseBurnState = { status: "hidden" };
        const preferenceResult = await supabase.from("user_preferences").select("show_exercise_calories")
          .eq("user_id", authData.user.id).maybeSingle();
        if (cancelled) return;
        if (preferenceResult.error) exercise = { status: "error" };
        else if (preferenceResult.data?.show_exercise_calories === true) {
          const activities = await supabase.from("activities").select("calories_burned").eq("user_id", authData.user.id)
            .gte("performed_at", today.start).lt("performed_at", today.end).limit(500);
          if (cancelled) return;
          exercise = activities.error ? { status: "error" } : {
            status: "ready", logs: (activities.data ?? []).length,
            calories: (activities.data ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.calories_burned) || 0), 0),
          };
        }
        const meals = (data ?? []) as unknown as RecentMeal[];
        setState({ status: "ready", summary: summarizeDailyNutrition(meals), meals, goals, exercise, dateLabel: today.label });
      } catch { if (!cancelled) setState({ status: "error" }); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey, selectedDay]);

  const ready = state.status === "ready" ? state : null;
  const summary = ready?.summary;
  const calories = summary?.calories ?? 0;
  const goal = ready?.goals.status === "ready" ? ready.goals : null;
  const progress = goal ? percent(calories, goal.calories) : 0;
  const remaining = goal ? goal.calories - calories : null;
  // These bars describe the composition of recorded macro energy, not invented daily targets.
  const energy = summary ? (summary.protein.grams * 4 + summary.carbs.grams * 4 + summary.fat.grams * 9) : 0;
  const macroBars = [
    { label: "Protein", value: summary ? displayMacro(summary.protein, summary.mealCount) : "—", pct: summary ? percent(summary.protein.grams * 4, energy) : 0, color: "mint" },
    { label: "Carbohydrates", value: summary ? displayMacro(summary.carbs, summary.mealCount) : "—", pct: summary ? percent(summary.carbs.grams * 4, energy) : 0, color: "blue" },
    { label: "Fat", value: summary ? displayMacro(summary.fat, summary.mealCount) : "—", pct: summary ? percent(summary.fat.grams * 9, energy) : 0, color: "peach" },
  ];
  const incomplete = summary ? [summary.protein, summary.carbs, summary.fat].some(m => m.incomplete) : false;
  return <section className="wellness-overview" aria-labelledby="today-overview-heading">
    <div className="wellness-greeting">
      <div><p className="wellness-eyebrow">Overview / {selectedDay}</p><h1 id="today-overview-heading">A healthier day starts here<span className="wellness-dot">.</span></h1><p className="wellness-greeting-sub">Your saved meals and small wins, all in one place.</p></div>
      <Link href="/?mode=photo" className="wellness-primary-cta">＋ Log a meal</Link>
    </div>
    <div className="wellness-toolbar" aria-label="Choose summary day">
      <div className="wellness-segment"><button type="button" aria-pressed={selectedDay === "today"} onClick={() => setSelectedDay("today")}>Today</button><button type="button" aria-pressed={selectedDay === "yesterday"} onClick={() => setSelectedDay("yesterday")}>Yesterday</button></div>
      <div className="flex items-center gap-2"><span className="text-xs opacity-65">{ready?.dateLabel ?? "Your local day"}</span><button type="button" onClick={refresh} disabled={state.status === "loading"} className="wellness-refresh" aria-label="Refresh nutrition totals">↻ Refresh</button></div>
    </div>
    {state.status === "guest" && <p role="status" className="wellness-notice"><Link href="/auth/login">Sign in</Link> to see your saved meals.</p>}
    {state.status === "error" && <p role="alert" className="wellness-notice">Could not load your nutrition totals. Try Refresh.</p>}
    {state.status === "loading" && <p role="status" className="wellness-notice">Loading your saved daily nutrition…</p>}
    <div className="wellness-primary-grid">
      <div className="wellness-card wellness-calorie-card">
        <div className="wellness-card-heading"><div><strong>🔥 Daily calories</strong><small>From saved meals {selectedDay === "today" ? "today" : "yesterday"}</small></div><span className="wellness-tag">{goal ? (remaining !== null && remaining < 0 ? "Over target" : "Daily target") : "Today's intake"}</span></div>
        <div className="wellness-cal-content"><div><p className="wellness-kcal" aria-busy={state.status === "loading"}>{ready ? number(calories) : "—"}<span>kcal</span></p>
          <p className="wellness-remaining">{goal ? <><strong>{remaining === null ? "—" : `${number(Math.abs(remaining))} kcal`}</strong> {remaining !== null && remaining < 0 ? "above" : "remaining of"} {number(goal.calories)}</> : <><Link href="/goals">Set a calorie goal</Link> to see your progress</>}</p>
          <Link href="/?mode=photo" className="wellness-lime-cta">＋ Add food <span aria-hidden="true">↗</span></Link></div>
          <div className="wellness-cal-ring" aria-label={goal ? `${number(progress)} percent of calorie target` : "Calorie target not configured"}>
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--ring-base)" strokeWidth="11"/><circle cx="60" cy="60" r="48" fill="none" stroke="var(--wellness-green)" strokeWidth="11" strokeLinecap="round" transform="rotate(-90 60 60)" strokeDasharray={`${(progress / 100) * 301.6} 301.6`} /></svg>
            <span><strong>{goal ? `${number(progress)}%` : "—"}</strong><small>{goal ? "of target" : "Set a goal"}</small></span>
          </div></div>
        {goal && <p className="wellness-macro-footnote">Only food intake counts toward these targets. Exercise is shown separately, not subtracted from your food target.</p>}
      </div>
      <div className="wellness-card wellness-macro-card">
        <div className="wellness-card-heading"><div><strong>Nutrition breakdown</strong><small>Recorded macro amounts</small></div><span className="wellness-tag">{selectedDay === "today" ? "TODAY" : "YESTERDAY"}</span></div>
        {macroBars.map(macro => <div key={macro.label} className="wellness-macro-line"><div><strong>{macro.label}</strong><span>{macro.value}{macro.label === "Protein" && goal ? ` / ${number(goal.protein)} g target` : ""}</span></div><div className="wellness-bar"><span className={`wellness-bar-${macro.color}`} style={{ width: `${macro.label === "Protein" && goal ? percent(summary?.protein.grams ?? 0, goal.protein) : macro.pct}%` }} /></div></div>)}
        <p className="wellness-macro-footnote">{incomplete ? "Some nutrients are unknown; totals may be incomplete. " : ""}Carb and fat bars show their share of logged macro energy, not daily targets.</p>
      </div>
    </div>
    <div className="wellness-section-heading"><h2>Quick log <span aria-hidden="true">✳</span></h2><small>Everything one tap away</small></div>
    <div className="wellness-quick-grid">
      <Link href="/?mode=photo" className="wellness-quick"><span className="wellness-quick-icon lime">📷</span><strong>Food scan</strong><small>AI photo analysis</small></Link>
      <Link href="/?mode=barcode" className="wellness-quick"><span className="wellness-quick-icon blue">▥</span><strong>Barcode</strong><small>Scan packaging</small></Link>
      <Link href="/?mode=manual" className="wellness-quick"><span className="wellness-quick-icon peach">✎</span><strong>Manual entry</strong><small>No AI needed</small></Link>
      <Link href="/dashboard#water" className="wellness-quick"><span className="wellness-quick-icon sky">💧</span><strong>Add water</strong><small>Track a drink</small></Link>
    </div>
    <div className="wellness-card wellness-meals-card">
      <div className="wellness-card-heading"><div><strong>{selectedDay === "today" ? "Today's meals" : "Yesterday's meals"}</strong><small>{ready ? `${ready.meals.length} saved meal${ready.meals.length === 1 ? "" : "s"}` : "From your food diary"}</small></div><Link className="wellness-green-link" href="/meals">View all ↗</Link></div>
      {ready?.meals.length ? ready.meals.slice(0, 5).map(meal => <div className="wellness-meal-row" key={meal.id}><span className="wellness-meal-emoji" aria-hidden="true">🍽️</span><div className="min-w-0 flex-1"><strong className="block truncate">{meal.meal_items?.map(i => i.name).filter(Boolean).slice(0, 2).join(" + ") || "Logged meal"}</strong><small>{new Date(meal.consumed_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></div><span className="wellness-meal-kcal">{number(Number(meal.total_calories) || 0)} <small>kcal</small></span></div>) : <p className="wellness-empty-meals">{ready ? "No meals recorded for this day yet. Log a meal to start." : "Your recently logged meals will appear here."}</p>}
    </div>
    {ready?.exercise.status === "ready" && <p className="wellness-activity-note">Estimated exercise calories: {number(ready.exercise.calories)} kcal from {ready.exercise.logs} logged sessions. These are not subtracted from food calories.</p>}
    {ready?.exercise.status === "error" && <p role="alert" className="wellness-activity-note">Activity estimates are temporarily unavailable.</p>}
    {ready?.goals.status === "error" && <p role="alert" className="wellness-activity-note">Personal targets are temporarily unavailable.</p>}
  </section>;
}
