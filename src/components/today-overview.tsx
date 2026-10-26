"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { targetProgress } from "@/lib/fitness-goals";
import {
  displayMacro,
  localDayWindow,
  summarizeDailyNutrition,
  type DailyNutritionSummary,
  type DailyMealRecord,
} from "@/lib/daily-nutrition";

type GoalStatus =
  | { status: "unset" }
  | { status: "error" }
  | { status: "ready"; calories: number; protein: number };

type ExerciseBurnState =
  | { status: "hidden" }
  | { status: "ready"; calories: number; logs: number }
  | { status: "error" };

type DashboardState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error" }
  | { status: "ready"; summary: DailyNutritionSummary; dateLabel: string; exercise: ExerciseBurnState; goals: GoalStatus };

export function TodayOverview() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<"today" | "yesterday">("today");

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });

      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;

        if (authError) {
          setState({ status: "error" });
          return;
        }
        if (!authData.user) {
          setState({ status: "guest" });
          return;
        }

        // This browser's local date determines the calorie-tracking day.
        const date = new Date();
        if (selectedDay === "yesterday") date.setDate(date.getDate() - 1);
        const today = localDayWindow(date);
        const { data, error } = await supabase
          .from("meals")
          .select("id, total_calories, total_protein, total_carbs, total_fat, analysis_snapshot")
          .eq("user_id", authData.user.id)
          .gte("consumed_at", today.start)
          .lt("consumed_at", today.end);

        if (cancelled) return;
        if (error) {
          setState({ status: "error" });
          return;
        }

        let goals: GoalStatus = { status: "unset" };
        const goalResult = await supabase.from("fitness_goals")
          .select("calorie_target,protein_target")
          .eq("user_id", authData.user.id).maybeSingle();
        if (cancelled) return;
        if (goalResult.error) {
          goals = { status: "error" };
        } else if (goalResult.data) {
          goals = { status: "ready", calories: Number(goalResult.data.calorie_target), protein: Number(goalResult.data.protein_target) };
        }

        let exercise: ExerciseBurnState = { status: "hidden" };
        const preferenceResult = await supabase.from("user_preferences")
          .select("show_exercise_calories")
          .eq("user_id", authData.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (preferenceResult.error) {
          exercise = { status: "error" };
        } else if (preferenceResult.data?.show_exercise_calories === true) {
          const activityResult = await supabase.from("activities")
            .select("calories_burned")
            .eq("user_id", authData.user.id)
            .gte("performed_at", today.start)
            .lt("performed_at", today.end)
            .limit(500);
          if (cancelled) return;
          if (activityResult.error) {
            exercise = { status: "error" };
          } else {
            const values = activityResult.data ?? [];
            exercise = {
              status: "ready",
              logs: values.length,
              calories: values.reduce((sum, item) => {
                const value = Number(item.calories_burned);
                return sum + (item.calories_burned !== null && Number.isFinite(value) && value >= 0 ? value : 0);
              }, 0),
            };
          }
        }

        setState({
          status: "ready",
          dateLabel: today.label,
          summary: summarizeDailyNutrition((data ?? []) as DailyMealRecord[]),
          exercise,
          goals,
        });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [refreshKey, selectedDay]);

  const summary = state.status === "ready" ? state.summary : null;
  const selectedLabel = selectedDay === "today" ? "today" : "yesterday";
  const cards = [
    {
      label: "Calories consumed",
      value: summary ? `${Math.round(summary.calories).toLocaleString()} kcal` : "—",
      note: `From saved meals eaten ${selectedLabel}`,
    },
    {
      label: "Protein",
      value: summary ? displayMacro(summary.protein, summary.mealCount) : "—",
      note: summary?.protein.incomplete ? "Incomplete: some foods have unknown protein" : "Recorded protein",
    },
    {
      label: "Carbs",
      value: summary ? displayMacro(summary.carbs, summary.mealCount) : "—",
      note: summary?.carbs.incomplete ? "Incomplete: some foods have unknown carbs" : "Recorded carbohydrates",
    },
    {
      label: "Fat",
      value: summary ? displayMacro(summary.fat, summary.mealCount) : "—",
      note: summary?.fat.incomplete ? "Incomplete: some foods have unknown fat" : "Recorded fat",
    },
  ];

  return (
    <section className="mt-9" aria-labelledby="today-overview-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="today-overview-heading" className="text-xl font-bold">
            {selectedDay === "today" ? "Today’s overview" : "Yesterday’s overview"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {state.status === "ready"
              ? `${state.dateLabel} · ${summary!.mealCount} saved meal${summary!.mealCount === 1 ? "" : "s"} · Your device's local time`
              : "Meals count toward the day you ate them, not the day you logged them."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Choose summary day">
            {(["today", "yesterday"] as const).map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDay(day)}
                aria-pressed={selectedDay === day}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  selectedDay === day
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {day === "today" ? "Today" : "Yesterday"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={state.status === "loading"}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Refresh totals
          </button>
        </div>
      </div>

      {state.status === "guest" && (
        <p role="status" className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <Link href="/auth/login" className="font-semibold text-emerald-700 hover:underline">Sign in</Link>{" "}
          to see your saved daily nutrition totals.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">
          Could not load your nutrition totals. Select Refresh totals to try again.
        </p>
      )}
      {state.status === "loading" && (
        <p role="status" className="mb-4 text-sm text-slate-500">Loading your saved meals…</p>
      )}
      {summary?.mealCount === 0 && (
        <p className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No meals recorded for {selectedLabel}. <Link href="/" className="font-semibold text-emerald-700 hover:underline">Log your first meal</Link>.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-4 text-2xl font-extrabold text-slate-900" aria-busy={state.status === "loading"}>
              {card.value}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">{card.note}</p>
          </div>
        ))}
      </div>

      {state.status === "ready" && state.goals.status === "ready" && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm" aria-label="Daily goal progress">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold">My food targets</h3><Link href="/goals" className="text-sm font-bold text-emerald-700 hover:underline">Edit goals →</Link></div>
          <p className="mt-1 text-xs text-slate-500">Only food intake counts toward these targets. Exercise does not change them.</p>
          {[
            { label: "Calories", current: summary?.calories ?? 0, target: state.goals.calories, unit: "kcal", incomplete: false },
            { label: "Protein", current: summary?.protein.grams ?? 0, target: state.goals.protein, unit: "g", incomplete: summary?.protein.incomplete ?? false },
          ].map(item => {
            const progress = targetProgress(item.current, item.target);
            return <div key={item.label} className="mt-4">
              <div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{item.label}{item.incomplete ? " (partial)" : ""}</span><span>{Math.round(item.current)} / {item.target} {item.unit}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${item.label} target progress`} aria-valuemin={0} aria-valuemax={item.target} aria-valuenow={Math.min(item.target, Math.round(item.current))}><div className="h-full rounded-full bg-emerald-500" style={{width: `${progress.percent}%`}} /></div>
              <p className="mt-1 text-xs text-slate-500">{item.incomplete ? "Some meals have unknown nutrients; the total may be higher." : progress.difference >= 0 ? `${progress.difference} ${item.unit} below your target` : `${-progress.difference} ${item.unit} above your target`}</p>
            </div>;
          })}
        </div>
      )}
      {state.status === "ready" && state.goals.status === "unset" && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Want to track your progress toward personal food targets? <Link href="/goals" className="font-bold text-emerald-700 underline">Set your goals</Link>.</p>
      )}
      {state.status === "ready" && state.goals.status === "error" && (
        <p role="alert" className="mt-4 text-sm text-red-700">Personal goals aren't available yet. Make sure the Phase 5 migration has been run.</p>
      )}

      {state.status === "ready" && state.exercise.status === "ready" && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Exercise calories (optional)</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{Math.round(state.exercise.calories).toLocaleString()} kcal</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Based on up to 500 saved workouts for {selectedLabel}. Estimates may include resting energy and are not subtracted from food calories or added to any target. <Link href="/settings" className="font-semibold text-emerald-700 hover:underline">Change display settings</Link>.</p>
        </div>
      )}
      {state.status === "ready" && state.exercise.status === "error" && (
        <p role="alert" className="mt-3 text-xs text-red-700">Exercise display preferences or activity totals could not be loaded. Your food totals are unaffected.</p>
      )}

      {summary && [summary.protein, summary.carbs, summary.fat].some((macro) => macro.incomplete) && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          A plus sign means at least that amount is recorded; some food entries have unknown macros. A zero is shown only when known or no meals were logged.
        </p>
      )}
    </section>
  );
}
