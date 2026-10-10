"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  displayMacro,
  localDayWindow,
  summarizeDailyNutrition,
  type DailyNutritionSummary,
  type DailyMealRecord,
} from "@/lib/daily-nutrition";

type DashboardState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error" }
  | { status: "ready"; summary: DailyNutritionSummary; dateLabel: string };

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

        setState({
          status: "ready",
          dateLabel: today.label,
          summary: summarizeDailyNutrition((data ?? []) as DailyMealRecord[]),
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

      {summary && [summary.protein, summary.carbs, summary.fat].some((macro) => macro.incomplete) && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          A plus sign means at least that amount is recorded; some food entries have unknown macros. A zero is shown only when known or no meals were logged.
        </p>
      )}
    </section>
  );
}
