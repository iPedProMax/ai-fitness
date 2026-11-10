"use client";

import { findManualFruits, findManualFruitById, type ManualFruit } from "@/lib/manual-fruit-catalog";

type Props = {
  query: string;
  selectedId?: string;
  onChoose: (fruit: ManualFruit) => void;
};

const shortcuts = ["Banana", "Mango", "Apple", "Papaya", "Watermelon"];

export function ManualFruitSuggestions({ query, selectedId, onChoose }: Props) {
  const active = selectedId ? findManualFruitById(selectedId) : undefined;
  const suggestions = findManualFruits(query);
  // The active fruit is already selected. Avoid offering an unnecessary duplicate.
  if (active && active.name === query.trim()) {
    return (
      <div role="status" className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Fresh fruit selected · USDA reference per 100 g edible portion. Changing grams recalculates calories and macros.
        <span className="mt-1 block text-[11px] text-emerald-700">Not specific to Philippine cultivars. Check peeled/seeded weight. <a href="https://github.com/tempolife-app/tempo-food-db" target="_blank" rel="noopener noreferrer" className="underline">Source: USDA via TempoLife (CC BY 4.0)</a>.</span>
      </div>
    );
  }
  if (query.trim().length === 0) {
    return (
      <div className="mt-2 space-y-1" aria-label="Fresh fruit quick selections">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-emerald-800">🍌 Fresh fruits:</span>
          {shortcuts.map(name => {
            const match = findManualFruits(name, 1)[0];
            if (!match) return null;
            return <button type="button" key={name} onClick={() => onChoose(match)}
              className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              {name}
            </button>;
          })}
        </div>
        <p className="text-[11px] text-slate-500">Select a fruit or type its name. Starts at 100 g edible weight if no weight is entered. No barcode or AI credit.</p>
      </div>
    );
  }
  if (!suggestions.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2" aria-label="Fresh fruit matching options">
      <p className="mb-2 text-xs font-semibold text-emerald-800">Fresh fruit matches · choose to autofill</p>
      <div className="max-h-52 space-y-1 overflow-auto">
        {suggestions.map(food => (
          <button key={food.id} type="button" onClick={() => onChoose(food)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-transparent bg-white px-3 py-2 text-left hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <span className="min-w-0 text-xs font-semibold text-slate-800">{food.name}</span>
            <span className="shrink-0 text-[11px] text-slate-600">{food.calories100g} kcal / 100 g</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        USDA SR Legacy 2018 reference values, via <a href="https://github.com/tempolife-app/tempo-food-db" target="_blank" rel="noopener noreferrer" className="underline">TempoLife (CC BY 4.0)</a>. Generic fruits may differ from local varieties; edible portion only.
      </p>
    </div>
  );
}
