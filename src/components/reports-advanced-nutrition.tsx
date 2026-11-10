"use client";

import { useState } from "react";
import {
  completenessLabel, formatRecordedNutrient, sumRecordedNutrient,
  type AdvancedReportDay,
} from "@/lib/advanced-nutrition-report";
import {
  ADVANCED_NUTRIENT_FIELDS, type AdvancedNutrientKey,
} from "@/lib/advanced-nutrients";

type Props = {
  days: readonly AdvancedReportDay[];
  view: "daily" | "weekly";
  selectedDate: string;
  truncated: boolean;
};

const explanations: Record<AdvancedNutrientKey, string> = {
  fiberG: "Dietary fiber recorded in grams.",
  sugarG: "Total sugars recorded, not necessarily added sugars.",
  saturatedFatG: "Historic saturated fat reading, hidden from the current report.",
  addedSugarG: "Recorded added sugar in g.",
  cholesterolMg: "Recorded cholesterol in mg.",
  potassiumMg: "Recorded potassium in mg.",
  calciumMg: "Recorded calcium in mg.",
  ironMg: "Recorded iron in mg.",
  vitaminDMcg: "Recorded vitamin d in mcg.",
  sodiumMg: "Sodium recorded in milligrams, not salt weight.",
};

function labelForDay(date: string): string {
  return date.slice(5);
}

export function ReportsAdvancedNutrition({ days, view, selectedDate, truncated }: Props) {
  const [focus, setFocus] = useState<AdvancedNutrientKey>("sugarG");
  const isWeekly = view === "weekly";
  const current = days.find(day => day.date === selectedDate);
  const fields = ADVANCED_NUTRIENT_FIELDS;
  const values = fields.map(field => ({
    ...field,
    summary: isWeekly ? sumRecordedNutrient(days, field.key) : current?.nutrients[field.key] ?? { total: 0, known: 0, missing: 0 },
  }));
  const focusedData = days.map(day => day.nutrients[focus]);
  const chartMax = Math.max(1, ...focusedData.filter(value => value.known > 0).map(value => value.total));
  const selected = fields.find(field => field.key === focus)!;
  const hasMeals = isWeekly ? days.some(day => day.mealCount > 0) : Boolean(current?.mealCount);

  return (
    <section aria-label="Advanced nutrient report" className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-700">Nutrition insights</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900">{isWeekly ? "Your recorded nutrients - last 7 days" : "Your recorded nutrients - selected day"}</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">Only nutrient values saved with food entries are included. Unrecorded values are unknown, not zero. A plus sign means an incomplete subtotal.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">From saved meals</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
        {values.map(value => (
          <div key={value.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">{value.label}</p>
            <p className="mt-2 break-words text-xl font-extrabold text-slate-900" aria-label={`${value.label}: ${formatRecordedNutrient(value.summary, value.key)}`}>{hasMeals ? formatRecordedNutrient(value.summary, value.key) : "No log"}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{hasMeals ? completenessLabel(value.summary) : "No saved meals in this period"}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Total sugar includes naturally occurring and added sugars. This report does not split them into separate amounts. These are logging summaries, not clinical assessments or nutrient-goal judgments.</p>
      {isWeekly && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-base font-bold text-slate-900">Seven-day nutrient trend</h3>
          <p className="mt-1 text-xs text-slate-600">Select a nutrient. Bars display the amount recorded, not a verified complete daily intake.</p>
          <div role="group" aria-label="Choose nutrient for the weekly trend" className="mt-4 flex flex-wrap gap-2">
            {fields.map(field => (
              <button key={field.key} type="button" aria-pressed={focus === field.key} onClick={() => setFocus(field.key)} className={`min-h-10 cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-emerald-500 ${focus === field.key ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                {field.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600">{explanations[focus]}</p>
          <div role="img" aria-label={`Seven-day ${selected.label.toLowerCase()} amounts recorded, missing days are unknown`} className="mt-4 grid grid-cols-7 items-end gap-2">
            {days.map(day => {
              const value = day.nutrients[focus];
              const missing = value.known === 0;
              const height = missing ? 0 : value.total === 0 ? 3 : Math.max(4, value.total / chartMax * 100);
              return (
                <div key={day.date} className="flex min-w-0 flex-col items-center gap-2">
                  <span className="text-center text-[10px] font-semibold text-slate-600">{!day.mealCount ? "No log" : missing ? "Unknown" : formatRecordedNutrient(value, focus)}</span>
                  <div className="flex h-24 w-full items-end rounded-lg bg-slate-100" title={`${day.date}: ${missing ? "Unknown" : formatRecordedNutrient(value, focus)}`}>
                    <div className={`w-full rounded-lg ${value.missing ? "bg-amber-400" : "bg-emerald-500"}`} style={{ height: `${height}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-600">{labelForDay(day.date)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Amber bars indicate at least one missing food value; full bars indicate all logged food entries provided that nutrient. Unlogged meals cannot be inferred.</p>
        </div>
      )}
      {truncated && <p role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The report query reached its 2,000-meal limit. Recorded totals might be incomplete.</p>}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">To record more nutrient values, use Log Food - Manual / Text - Optional advanced nutrients. Existing older meals can remain Unknown. No AI estimation or extra credits are used here.</p>
    </section>
  );
}