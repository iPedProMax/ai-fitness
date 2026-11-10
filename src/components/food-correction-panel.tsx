"use client";

import { useState, type FormEvent } from "react";
import { foodAnalysisSchema, type FoodAnalysis } from "@/lib/food-analysis";
import { ADVANCED_NUTRIENT_FIELDS, type AdvancedNutrientKey } from "@/lib/advanced-nutrients";
import { applyFoodCorrection, type FoodCorrection } from "@/lib/food-correction";

type Props = {
  analysis: FoodAnalysis;
  onApply: (next: FoodAnalysis) => void;
};

type Field = Exclude<keyof FoodCorrection, "name">;
const numbers: { key: Field; label: string; unit: string }[] = [
  { key: "estimatedGrams", label: "Serving weight", unit: "g" },
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbohydrates", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

type Draft = Record<Field, string> & { name: string; advanced: Partial<Record<AdvancedNutrientKey, string>> };
function initialDraft(food: FoodAnalysis["foods"][number]): Draft {
  return {
    name: food.name,
    estimatedGrams: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    advanced: {},
  };
}

export function FoodCorrectionPanel({ analysis, onApply }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!analysis.foods.length) return null;

  function pick(index: number) {
    const food = analysis.foods[index];
    if (!food) return;
    setSelectedIndex(index);
    setDraft(initialDraft(food));
    setError(null);
    setNotice(null);
  }
  function start() {
    pick(0);
    setExpanded(true);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const values: Partial<Record<Field, number>> = {};
    for (const field of numbers) {
      const raw = draft[field.key].trim();
      if (!raw) continue; // Leave the AI value unchanged if the field is blank.
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100000) {
        setError("Enter valid non-negative nutrition values.");
        return;
      }
      values[field.key] = value;
    }
    try {
      const updated = applyFoodCorrection(analysis, selectedIndex, {
        name: draft.name,
        ...values,
      });
      if (updated === analysis && !ADVANCED_NUTRIENT_FIELDS.some(field => draft.advanced[field.key]?.trim())) {
        setError("Change the name or enter at least one value before applying.");
        return;
      }
      // Record only values deliberately entered. Blank fields preserve existing readings.
      const selected = updated.foods[selectedIndex];
      if (!selected) throw new Error("Food selection changed. Retry.");
      const advanced = { ...(selected.advancedNutrients ?? {}) };
      for (const field of ADVANCED_NUTRIENT_FIELDS) {
        const raw = draft.advanced[field.key]?.trim();
        if (!raw) continue;
        const value = Number(raw);
        const limit = field.unit === "mg" ? 100000 : 1000;
        if (!Number.isFinite(value) || value < 0 || value > limit) {
          setError(field.label + " must be a valid non-negative value.");
          return;
        }
        advanced[field.key] = value;
      }
      const next = foodAnalysisSchema.parse({ ...updated, foods: updated.foods.map((food,i) => i===selectedIndex
        ? { ...food, ...(Object.keys(advanced).length ? { advancedNutrients: advanced } : {}) } : food) });
      onApply(next);
      setExpanded(false);
      setError(null);
      setNotice("Food correction applied. Review the meal total before saving.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to apply correction.");
    }
  }
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Is the food prediction wrong?</p>
          <p className="mt-1 text-xs text-slate-600">Correct it yourself. No AI credit needed.</p>
        </div>
        <button type="button" onClick={() => expanded ? setExpanded(false) : start()}
          className="cursor-pointer rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
          {expanded ? "Cancel correction" : "Wrong prediction?"}
        </button>
      </div>
      {notice && !expanded && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
      {expanded && draft && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {analysis.foods.length > 1 && (
            <label className="block text-sm font-medium text-slate-800">Food to correct
              <select value={selectedIndex} onChange={event => pick(Number(event.target.value))}
                className="mt-1 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600">
                {analysis.foods.map((food, index) => <option key={index} value={index}>{food.name}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-slate-800">Correct food name
            <input type="text" required maxLength={120} value={draft.name}
              onChange={event => setDraft({ ...draft, name: event.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-emerald-600"/>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {numbers.map(field => (
              <label key={field.key} className="block text-xs font-medium text-slate-800">
                {field.label} ({field.unit}) - optional
                <input type="number" inputMode="decimal" min="0" max="100000" step="any"
                  placeholder={`Keep current: ${analysis.foods[selectedIndex]?.[field.key] ?? "unknown"}`}
                  value={draft[field.key]}
                  onChange={event => setDraft({ ...draft, [field.key]: event.target.value })}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600"/>
              </label>
            ))}
          </div>
          <details className="rounded-xl border border-amber-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">More nutrition from a label (optional)</summary>
            <p className="mt-2 text-xs text-slate-600">These values are not guessed from the photo. Enter the amount for the serving you actually consumed; blank keeps the current reading.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ADVANCED_NUTRIENT_FIELDS.map(field => (
                <label key={field.key} className="text-xs font-medium text-slate-800">{field.label} ({field.unit})
                  <input type="number" min="0" max={field.unit === "mg" ? 100000 : 1000} step="any"
                    value={draft.advanced[field.key] ?? ""}
                    placeholder={analysis.foods[selectedIndex]?.advancedNutrients?.[field.key] === undefined ? "Unknown" : String(analysis.foods[selectedIndex]?.advancedNutrients?.[field.key])}
                    onChange={event => setDraft(current => current ? { ...current, advanced: { ...current.advanced, [field.key]: event.target.value } } : current)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
              ))}
            </div>
          </details>
          <p className="text-xs leading-5 text-amber-900">
            Only the food name is required. Leave numeric fields blank to keep the current values.
            Changing the food name or weight does not recalculate calories or macros.
            Existing values may be inaccurate for the corrected food, so review them before saving.
            Only treat scale weight as food-only weight if the container was tared.
          </p>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            Apply correction
          </button>
        </form>
      )}
    </div>
  );
}
