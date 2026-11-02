"use client";

import type { FoodAnalysis } from "@/lib/food-analysis";
import { summarizeExpandedNutrients } from "@/lib/expanded-nutrient-totals";

/** Read-only optional nutrient totals; opening it never spends an AI credit. */
export function MealAdvancedNutrientsSummary({ foods }: { foods: FoodAnalysis["foods"] }) {
  const rows = summarizeExpandedNutrients(foods);
  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <summary className="cursor-pointer text-sm font-bold text-emerald-700">More nutrition: sugar, fiber, minerals and vitamins</summary>
      <p className="mt-2 text-xs leading-5 text-slate-600">Available nutrient values will be saved with Add Meal. Unknown is not zero. A + means some foods lack that nutrient; use the nutrition editor to supply a supported value.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map(row => (
          <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{row.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{row.display}</p>
            <p className="mt-1 text-[11px] text-slate-500">{row.known}/{row.known+row.missing} foods with values</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Gemini may transcribe readable nutrition labels, but AI-extracted values must be checked against the label and serving size. Use Wrong prediction? to correct them. Without a label, optional values may be rough AI estimates; unknowns stay unknown.</p>
    </details>
  );
}