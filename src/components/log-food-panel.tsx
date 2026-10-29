"use client";

import { useState } from "react";
import type { AiProviderChoice } from "@/components/ai-provider-picker";
import type { FormEvent } from "react";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { analyzeFoodText } from "@/lib/analyze-food-text";
import { makeManualFoodAnalysis, type ManualFoodInput } from "@/lib/manual-food";
import { foodEmoji } from "@/lib/food-emoji";


function emptyItem(): ManualFoodInput {
  return { name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" };
}

function toTextNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Preserve manually entered values when AI supplies missing values. */
export function fillMissingFromAi(
  current: ManualFoodInput[],
  suggested: FoodAnalysis["foods"]
): ManualFoodInput[] {
  const used = new Set<number>();
  const filled = suggested.map((food, index) => {
    const normalizedName = food.name.trim().toLocaleLowerCase();
    const match = current.findIndex((item, i) =>
      !used.has(i) && item.name.trim().toLocaleLowerCase() === normalizedName
    );
    // The first existing row can also correspond to a single-food suggestion.
    const fallback = current.length === 1 && suggested.length === 1 ? 0 : -1;
    const found = match >= 0 ? match : fallback;
    if (found >= 0) used.add(found);
    const original = found >= 0 ? current[found] : emptyItem();
    return {
      name: original.name.trim() || food.name,
      grams: original.grams.trim() || toTextNumber(food.estimatedGrams),
      calories: original.calories.trim() || toTextNumber(food.calories),
      protein: original.protein.trim() || toTextNumber(food.protein),
      carbs: original.carbs.trim() || toTextNumber(food.carbs),
      fat: original.fat.trim() || toTextNumber(food.fat),
    };
  });
  // Never silently discard a user's manually entered food or known values.
  const leftover = current.filter((item, i) => !used.has(i) &&
    (item.name.trim() || item.calories.trim() || item.protein.trim() || item.carbs.trim() || item.fat.trim())
  );
  return [...filled, ...leftover];
}

type Props = {
  onResult: (result: FoodAnalysis) => void;
  onReset: () => void;
  providerId?: AiProviderChoice;
};

export function LogFoodPanel({ onResult, onReset, providerId = "gemini" }: Props) {
  const [items, setItems] = useState<ManualFoodInput[]>([emptyItem()]);
  const [description, setDescription] = useState("");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, key: keyof ManualFoodInput, value: string) {
    onReset();
    setItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
    setError(null);
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      onResult(makeManualFoodAnalysis(items, { aiAssisted }));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Invalid food details.");
    }
  }

  async function handleAi() {
    if (working) return;
    const prompt = description.trim() || items.map((item) =>
      [item.name.trim(), item.grams.trim() ? `${item.grams.trim()} g` : ""].filter(Boolean).join(", ")
    ).filter(Boolean).join("; ");
    if (prompt.length < 3) {
      setError("Describe the food or enter a food name before asking AI.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const estimate = await analyzeFoodText(prompt, { modelId: providerId });
      if (estimate.foods.length === 0) {
        throw new Error("AI did not return a food estimate.");
      }
      const next = fillMissingFromAi(items, estimate.foods);
      if (next.length > 10) throw new Error("Too many foods. Please split this meal.");
      onReset();
      setItems(next);
      setAiAssisted(true);
    } catch (issue) {

      setError(issue instanceof Error ? issue.message : "AI estimation failed.");
    } finally {
      setWorking(false);
    }
  }

  const numberOrZero = (text: string) => {
    const value = Number(text);
    return text.trim() && Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const knownCalories = items.reduce((sum, food) => sum + numberOrZero(food.calories), 0);
  const knownProtein = items.reduce((sum, food) => sum + numberOrZero(food.protein), 0);
  const knownCarbs = items.reduce((sum, food) => sum + numberOrZero(food.carbs), 0);
  const knownFat = items.reduce((sum, food) => sum + numberOrZero(food.fat), 0);
  const calorieEntriesMissing = items.some(food => !food.calories.trim());
  const ambiguousPortions = /\b(dab|little|some|handful|spoonful|splash|pinch|few|small amount)\b/i.test(description);
  const inputClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold">Manual / AI Food Entry</h3>
      <p className="mt-1 text-sm text-slate-500">Enter what you know. AI can fill missing details, but it's optional.</p>
      <div className="mt-5 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <label className="block text-sm font-semibold text-slate-700">
          Describe your meal (optional)
          <textarea rows={3} maxLength={600} value={description}
            onChange={(event) => { onReset(); setDescription(event.target.value); }}
            placeholder="e.g. 200 g grilled bangus with one cup of rice"
            className={inputClass} />
        </label>
        <button type="button" onClick={handleAi} disabled={working}
          className="w-full rounded-xl border border-emerald-400 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60">
          {working ? "Estimating..." : "✨ Estimate nutrition with AI"}
        </button>
        <p className="text-xs text-slate-500">AI only runs when you press the button. Your existing typed values won't be overwritten.</p>
      </div>
      <form onSubmit={handleReview} className="mt-5 space-y-4">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
          <div className="min-w-0 space-y-4">
        {items.map((item, index) => (
          <fieldset key={index} className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Food {index + 1}</legend>
            <div className="mb-3 flex items-center gap-3">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-2xl">{foodEmoji(item.name)}</span>
              <span className="text-xs text-slate-500">Automatic food emoji; no image needed</span>
            </div>
            <label className="block text-xs font-medium text-slate-600">Food name (required)
              <input required maxLength={120} value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="e.g. Grilled bangus" className={inputClass} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([
                ["grams", "Serving weight (g, optional)"],
                ["calories", "Calories (kcal)"],
                ["protein", "Protein (g, optional)"],
                ["carbs", "Carbs (g, optional)"],
                ["fat", "Fat (g, optional)"],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-medium text-slate-600">{label}
                  <input type="number" min="0" step="any" value={item[key]}
                    onChange={(event) => updateItem(index, key, event.target.value)}
                    placeholder={key === "calories" ? "Required unless all macros entered" : "Optional"}
                    className={inputClass} />
                </label>
              ))}
            </div>
            {items.length > 1 && <button type="button" className="mt-3 text-xs font-semibold text-red-600 hover:underline" onClick={() => { onReset(); setItems((current) => current.filter((_, i) => i !== index)); }}>Remove item</button>}
          </fieldset>
        ))}
        {items.length < 10 && (
          <button type="button" onClick={() => { onReset(); setItems((current) => [...current, emptyItem()]); }} className="text-sm font-semibold text-emerald-700 hover:underline">+ Add another food</button>
        )}
          </div>
          <aside aria-label="Live nutrition summary" className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Live nutrition summary</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{Math.round(knownCalories)} <span className="text-sm font-medium text-slate-600">kcal entered</span></p>
            <p className="mt-1 text-xs text-slate-500">Only includes calories entered above; no missing values are treated as confirmed zero.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownProtein.toFixed(1)}g</span>Protein*</div>
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownCarbs.toFixed(1)}g</span>Carbs*</div>
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownFat.toFixed(1)}g</span>Fat*</div>
            </div>
            <p className="mt-2 text-xs text-slate-500">*Totals of provided values only; blank macros remain unknown.</p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">AI confidence: Not calibrated</p>
              <p className="mt-1">A verified confidence percentage is not yet available for manual text estimates. Review amounts before saving.</p>
              {ambiguousPortions && <p className="mt-2 font-medium">Your description uses a vague portion (such as a dab or spoonful). Enter an approximate quantity to improve accuracy.</p>}
              {calorieEntriesMissing && <p className="mt-2">Some foods have no entered calories, so this total is incomplete.</p>}
            </div>
          </aside>
        </div>
        <button type="submit" disabled={working} className="block w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">Review &amp; Add Meal</button>
        <p className="text-xs leading-5 text-slate-500">Food name and calories are needed to save (or enter all three macros to estimate calories). Blank macros stay Unknown, not 0 g.</p>
        {aiAssisted && <p className="text-xs text-emerald-700">AI suggested nutrition values; review and correct them before saving.</p>}
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
