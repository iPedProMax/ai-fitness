"use client";

import { useState } from "react";
import Link from "next/link";
import type { createWeeklyReport } from "@/lib/weekly-report";
import { displayMacro } from "@/lib/daily-nutrition";
import { buildSevenDayChartModel } from "@/lib/report-chart-model";

type ReportDay = ReturnType<typeof createWeeklyReport>[number];

function dayName(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "Asia/Manila" })
    .format(new Date(`${date}T12:00:00+08:00`));
}

function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })
    .format(new Date(`${date}T12:00:00+08:00`));
}

function readable(number: number): string {
  return Math.round(number).toLocaleString("en-PH");
}

export function ReportsInteractiveChart({
  report,
  calorieTarget,
}: {
  report: readonly ReportDay[];
  calorieTarget: number | null;
}) {
  const chart = buildSevenDayChartModel(report, calorieTarget);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const active = chart.days.find(day => day.date === selectedDate) ?? chart.days.at(-1);

  return (
    <section aria-labelledby="khalories-v2-chart-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Tap a day for details</p>
          <h2 id="khalories-v2-chart-heading" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Calories logged — last 7 days</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Bars show recorded food calories, not total food eaten. No log means no meals were saved that day.</p>
        </div>
        {chart.goal !== null && (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Daily goal: <strong>{readable(chart.goal)} kcal</strong>
          </div>
        )}
      </div>

      <div role="group" aria-label="Choose a Philippine calendar day to inspect logged nutrition" className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-3">
        {chart.days.map(day => {
          const selected = day.date === active?.date;
          const goalPercent = chart.goal !== null ? Math.min(100, (chart.goal / chart.maximum) * 100) : null;
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={selected}
              aria-label={`${fullDate(day.date)}: ${day.hasLog ? `${day.caloriesLabel}, ${day.mealCount} meal log${day.mealCount === 1 ? "" : "s"}` : "no meal logs"}. Show day details.`}
              onClick={() => setSelectedDate(day.date)}
              className={`group min-w-0 rounded-xl p-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:p-2 ${selected ? "bg-emerald-50 ring-2 ring-emerald-400" : "hover:bg-slate-100"}`}
            >
              <span className="block truncate text-[10px] font-semibold text-slate-600 sm:text-xs">{day.hasLog ? readable(day.calories) : "—"}</span>
              <span className="relative mt-2 flex h-32 items-end overflow-hidden rounded-lg bg-slate-100 sm:h-40" aria-hidden="true">
                {goalPercent !== null && (
                  <span className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-violet-500/70" style={{ bottom: `${goalPercent}%` }} />
                )}
                {day.hasLog && day.calories > 0 && (
                  <span className={`block w-full rounded-t-md transition-[height] duration-300 motion-reduce:transition-none ${selected ? "bg-emerald-600" : "bg-emerald-500"}`} style={{ height: `${day.heightPercent}%` }} />
                )}
                {!day.hasLog && <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_10px,rgba(148,163,184,0.15)_10px,rgba(148,163,184,0.15)_14px)]" />}
              </span>
              <span className="mt-2 block truncate text-[10px] font-semibold text-slate-700 sm:text-xs">{dayName(day.date)}</span>
              <span className="block truncate text-[9px] text-slate-500 sm:text-[11px]">{day.date.slice(5)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span><span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Logged kcal</span>
        <span>No bar + striped background = not logged</span>
        {chart.goal !== null && <span><span aria-hidden="true" className="mr-1 inline-block w-4 border-t-2 border-dashed border-violet-500 align-middle" /> Your food target</span>}
      </div>

      {active && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Selected day</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{fullDate(active.date)}</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {active.hasLog ? `${active.mealCount} meal log${active.mealCount === 1 ? "" : "s"}` : "No saved meals"}
            </span>
          </div>
          {active.hasLog ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Calories logged", value: `${readable(active.calories)} kcal` },
                  { label: "Protein logged", value: displayMacro(active.protein, active.mealCount) },
                  { label: "Carbs logged", value: displayMacro(active.carbs, active.mealCount) },
                  { label: "Fat logged", value: displayMacro(active.fat, active.mealCount) },
                ].map(metric => (
                  <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{metric.value}</p>
                  </div>
                ))}
              </div>
              {chart.goal !== null && (
                <p className="mt-3 text-xs text-slate-600">
                  Logged food: {readable(active.calories)} of your {readable(chart.goal)} kcal daily target. Partial logging may understate actual intake.
                </p>
              )}
              {(active.protein.incomplete || active.carbs.incomplete || active.fat.incomplete) && (
                <p role="note" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Some macros were not entered for this day. A + means at least that much was recorded, not a complete total.
                </p>
              )}
              <Link href="/meals" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-emerald-700 hover:underline">Review meal history →</Link>
            </>
          ) : (
            <div className="mt-4">
              <p className="text-sm leading-6 text-slate-600">No meals were saved for this day. This does not mean you ate zero calories, and this day is excluded from your logged-day averages.</p>
              <Link href="/" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-emerald-700 hover:underline">Log food →</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}