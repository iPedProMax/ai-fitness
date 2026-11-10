import Link from "next/link";
import { AdvancedNutrientsSummary } from "@/components/advanced-nutrients-summary";
import { reportFoodRows, reportFoodWeight, reportMealTitle, reportNutrient, reportFoodAdvanced, type ReportFoodRow, type ReportMeal } from "@/lib/report-meal-details";
import type { Macro } from "@/lib/daily-nutrition";

function timeInPhilippines(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
  }).format(date);
}

function macro(row: ReportFoodRow, name: Macro): string {
  return reportNutrient(row[name], row.unknownMacros.includes(name));
}

/** Server-rendered disclosure: opening a meal does not call AI or request new data. */
export function DailyMealDetails({ meal }: { meal: ReportMeal }) {
  const rows = reportFoodRows(meal);
  const fallback = rows.some(row => row.source === "snapshot");
  return (
    <li className="px-4 py-3">
      <details className="group rounded-xl border border-slate-200 bg-white open:bg-slate-50">
        <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-bold text-slate-900">{reportMealTitle(rows)}</span>
            <span className="mt-1 block text-xs text-slate-500">{timeInPhilippines(meal.consumed_at)} - Philippine time</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-bold text-slate-900">{reportNutrient(meal.total_calories, false, "kcal")}</span>
            <span aria-hidden="true" className="text-sm font-semibold text-emerald-700 transition-transform group-open:rotate-180">&#9662;</span>
          </span>
        </summary>
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            {([
              ["Protein", "protein"], ["Carbs", "carbs"], ["Fat", "fat"],
            ] as const).map(([label, key]) => (
              <div className="rounded-xl bg-slate-100 p-2.5" key={key}>
                <p className="text-slate-500">{label} (meal)</p>
                <p className="mt-1 font-semibold text-slate-900">{(() => {
                  const isUnknown = rows.some(row => row.unknownMacros.includes(key));
                  return reportNutrient(meal[`total_${key}`], isUnknown);
                })()}</p>
              </div>
            ))}
          </div>
          {rows.length ? (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Recorded food items</p>
              <ul className="space-y-2">
                {rows.map(row => (
                  <li key={row.key} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-900">{row.name}</p>
                        {reportFoodWeight(row) && <p className="mt-1 text-xs text-slate-500">{reportFoodWeight(row)}</p>}
                      </div>
                      <p className="text-sm font-bold text-slate-900">{reportNutrient(row.calories, false, "kcal")}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>Protein: {macro(row, "protein")}</span>
                      <span>Carbs: {macro(row, "carbs")}</span>
                      <span>Fat: {macro(row, "fat")}</span>
                    </div>
                    <AdvancedNutrientsSummary values={reportFoodAdvanced(meal, row)} />
                  </li>
                ))}
              </ul>
              {fallback && <p className="mt-3 text-xs text-amber-800">Individual food details come from the saved analysis snapshot. Visit Meal History for the current saved record.</p>}
              {rows.some(row => row.unknownMacros.length > 0) && <p className="mt-3 text-xs text-slate-500">Unknown macros were not supplied when logged. They are not counted as zero grams.</p>}
            </>
          ) : (
            <p className="text-sm text-slate-600">This older saved meal has no individual food details. Its recorded meal totals remain available.</p>
          )}
          {meal.notes?.trim() && <p className="mt-3 whitespace-pre-wrap break-words border-t border-slate-200 pt-3 text-xs text-slate-600">Notes: {meal.notes}</p>}
          <Link href="/meals" className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-emerald-700 hover:underline">View in Meal History &#8594;</Link>
        </div>
      </details>
    </li>
  );
}