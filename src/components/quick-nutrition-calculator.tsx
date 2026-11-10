"use client";

import { useMemo, useState } from "react";
import {
  findQuickFoodById, quickFoods, quickNutrition, searchQuickFoods,
  type QuickFood, type QuickFoodCategory, type QuickNutritionUnit,
} from "@/lib/quick-nutrition-calculator";

export type QuickNutritionSelection = {
  food: QuickFood;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number | null;
  sugarG: number | null;
};

type Filter = "All" | QuickFoodCategory;
const filters: readonly Filter[] = ["All", "Everyday", "Fruit", "Drink"];
const showNumber = (value: number) => String(Number(value.toFixed(2)));

/** Manual-entry aid; uses stored reference data, not AI or network calls. */
export function QuickNutritionCalculator({ onUse }: { onUse: (selection: QuickNutritionSelection) => boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Filter>("All");
  const [foodId, setFoodId] = useState("staple-rice-white-cooked");
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<QuickNutritionUnit>("g");
  const [notice, setNotice] = useState("");
  const food = findQuickFoodById(foodId) ?? quickFoods[0];
  const options = useMemo(() => searchQuickFoods(query, category, 18), [query, category]);
  const gramsAvailable = food.category === "Drink" && food.densityGPerMl !== undefined;
  const value = Number(amount);
  const result = useMemo(() => {
    try { return amount.trim() ? quickNutrition(food, value, unit) : null; }
    catch { return null; }
  }, [food, amount, unit, value]);

  function pick(next: QuickFood) {
    setFoodId(next.id);
    setUnit("g");
    setAmount(next.category === "Drink" ? "200" : "100");
    setNotice("");
  }
  function apply() {
    if (!result) { setNotice("Enter a valid food amount before using this result."); return; }
    if (!onUse({ food, ...result })) { setNotice("Could not add this food. Check the message below the form."); return; }
    setNotice(`${food.name} was added to your manual meal. Review its values before saving.`);
  }

  return <section aria-labelledby="quick-nutrition-title" className="mt-5 overflow-hidden rounded-3xl border border-[#d6e5d1] bg-gradient-to-br from-[#fafff7] via-white to-[#eef8ed] p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#44805c]">Measure it. Know it.</p>
        <h3 id="quick-nutrition-title" className="mt-1 text-xl font-extrabold tracking-tight text-[#193e2b]">Quick Nutrition Calculator</h3>
        <p className="mt-1 text-sm text-[#526a57]">Select a reference food and enter your actual portion. Calories and macros update instantly.</p>
      </div>
      <span className="rounded-full border border-[#c7e1bc] bg-[#e5f5dc] px-3 py-1.5 text-xs font-bold text-[#245c38]">0 AI credits</span>
    </div>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Reference food categories">
      {filters.map(filter => <button key={filter} type="button" aria-pressed={filter === category}
        onClick={() => setCategory(filter)}
        className={`min-h-10 cursor-pointer rounded-full border px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${filter === category ? "border-[#205a3e] bg-[#205a3e] text-white" : "border-[#cfded0] bg-white text-[#2c5941] hover:border-emerald-500"}`}>{filter === "Fruit" ? "Fruits" : filter === "Drink" ? "Drinks" : filter}</button>)}
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <div className="min-w-0 space-y-3">
        <label className="block text-xs font-bold text-[#31543c]">Search reference foods
          <input type="search" value={query} maxLength={70} onChange={event => setQuery(event.target.value)}
            placeholder="Try rice, banana, eggs, milk, mango..." autoComplete="off"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-[#cfddcd] bg-white px-3.5 text-sm text-[#244630] outline-none focus:border-[#5ba378] focus:ring-2 focus:ring-emerald-100" />
        </label>
        {query.trim() && <div className="max-h-44 overflow-y-auto rounded-xl border border-[#d9e6d8] bg-white p-1.5" role="listbox" aria-label="Food matches">
          {options.length ? options.map(option => <button type="button" key={option.id} role="option" aria-selected={foodId === option.id}
            onClick={() => pick(option)} className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#eef8eb] ${foodId === option.id ? "bg-[#e4f4dd] text-[#175137]" : "text-[#325341]"}`}>
            <span className="truncate font-semibold">{option.name}</span><span className="shrink-0 text-[#6b826e]">{option.category}</span>
          </button>) : <p className="p-3 text-xs text-slate-600">No exact reference for that food yet. Use the product search above or manual entry.</p>}
        </div>}
        <label className="block text-xs font-bold text-[#31543c]">Selected reference
          <select value={foodId} onChange={event => { const next = findQuickFoodById(event.target.value); if (next) pick(next); }}
            className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-[#cfddcd] bg-white px-3.5 text-sm text-[#244630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <optgroup label="Everyday foods">{quickFoods.filter(item => item.category === "Everyday").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            <optgroup label="Drinks">{quickFoods.filter(item => item.category === "Drink").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            <optgroup label="Fresh fruits">{quickFoods.filter(item => item.category === "Fruit").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
          </select>
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="block text-xs font-bold text-[#31543c]">How much did you eat?
            <input type="number" inputMode="decimal" min="0.01" max="5000" step="any" value={amount} onChange={event => { setAmount(event.target.value); setNotice(""); }}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#cfddcd] bg-white px-3.5 text-sm text-[#244630] focus:border-[#5ba378] focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block text-xs font-bold text-[#31543c]">Measured in
            <select value={unit} onChange={event => { setUnit(event.target.value as QuickNutritionUnit); setNotice(""); }}
              className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-[#cfddcd] bg-white px-3.5 text-sm text-[#244630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              <option value="g">grams (g)</option><option value="oz">weight ounces (oz)</option>
              {gramsAvailable && <option value="mL">milliliters (mL)</option>}
            </select>
          </label>
        </div>
        <p className="text-xs leading-5 text-[#637866]">{result ? `Food-only serving weight: ${showNumber(result.grams)} g (no plate, bowl, or packaging).` : "Enter a valid positive quantity (up to 5,000 g)."} {gramsAvailable ? "Volume-to-weight uses an approximate drink-specific density." : "Volume isn't interchangeable with grams for solid foods."}</p>
        <p className="text-[11px] leading-5 text-[#607362]">Reference: <a href={food.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-emerald-700">{food.source}</a>. Check food preparation, edible portion, and actual packaging for accuracy.</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-[#dcebd8] bg-white/90 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#54795d]">For your portion</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-[#1a4430]">{result ? showNumber(result.calories) : "—"}<span className="ml-1 text-sm font-semibold text-[#597561]">kcal</span></p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([ ["Protein",result?.protein],["Carbs",result?.carbs],["Fat",result?.fat] ] as const).map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-[#eff7ea] px-2 py-3 text-center"><p className="text-[10px] text-[#5f7562]">{label}</p><p className="mt-1 text-sm font-extrabold text-[#1a4430]">{value === undefined ? "—" : `${showNumber(value)}g`}</p></div>)}
        </div>
        {result && <p className="mt-3 text-[11px] text-[#5e7360]">Fiber: {result.fiberG === null ? "Unknown" : showNumber(result.fiberG) + "g"} · Sugar: {result.sugarG === null ? "Unknown" : showNumber(result.sugarG) + "g"}</p>}
        <button type="button" disabled={!result} onClick={apply}
          className="mt-4 min-h-12 w-full cursor-pointer rounded-xl bg-[#1c6543] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#124a30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">Add this portion to my meal</button>
        <p className="mt-2 text-center text-[11px] text-[#69806a]">Review your food below before saving</p>
      </div>
    </div>
    {notice && <p role="status" className="mt-3 rounded-xl border border-[#b9dfb6] bg-[#f4fff0] px-3 py-2 text-xs font-semibold text-[#285c39]">{notice}</p>}
  </section>;
}
