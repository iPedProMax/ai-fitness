"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogFood } from "@/lib/open-food-facts";

type Props = {
  mode: "browse" | "manual" | "barcode";
  initialQuery?: string;
  onSelect?: (food: CatalogFood, source: string) => void;
  onQueryChange?: (query: string) => void;
};
type SearchResponse = { foods?: unknown; communityFoods?: unknown; source?: unknown; error?: unknown };

const reviewedSource = "Khalories Philippine Food Library";
const popularSearches = ["Rice", "Nissin", "Tuna", "Biscuits"] as const;

function asFoods(value: unknown): CatalogFood[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CatalogFood => {
    if (!item || typeof item !== "object") return false;
    const food = item as CatalogFood;
    return typeof food.name === "string" && food.name.trim().length > 0 &&
      typeof food.barcode === "string" && /^\d{8,14}$/.test(food.barcode) &&
      [food.calories100g, food.protein100g, food.carbs100g, food.fat100g].every(
        value => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0)
      );
  }).slice(0, 8);
}
function nutrition(value: number | null, unit: string) {
  return value === null ? "—" : `${Number(value.toFixed(1))} ${unit}`;
}
function hasNutrients(food: CatalogFood) {
  return [food.calories100g, food.protein100g, food.carbs100g, food.fat100g].some(value => value !== null);
}

/** Reviewed suggestions as-you-type; outside catalog only on the explicit submit action. */
export function FoodSmartSearch({ mode, initialQuery = "", onSelect, onQueryChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [reviewed, setReviewed] = useState<CatalogFood[]>([]);
  const [localCommunity, setLocalCommunity] = useState<CatalogFood[]>([]);
  const [community, setCommunity] = useState<CatalogFood[] | null>(null);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const localNumber = useRef(0);
  const searchNumber = useRef(0);
  const externalController = useRef<AbortController | null>(null);
  const searchText = query.trim();
  const valid = searchText.length >= 3 && searchText.length <= 60;

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const abort = new AbortController();
    const number = ++localNumber.current;
    // Invalidate the previous external search if someone edits their query.
    ++searchNumber.current;
    externalController.current?.abort();
    externalController.current = null;
    setReviewed([]);
    setLocalCommunity([]);
    setCommunity(null);
    setSearchedTerm("");
    setSearching(false);
    setError("");
    setSelected("");
    if (query.trim().length < 3 || query.trim().length > 60) {
      setLocalBusy(false);
      return () => abort.abort();
    }
    setLocalBusy(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/food/library/suggest?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store", signal: abort.signal,
        });
        if (!response.ok) throw new Error("Reviewed suggestions unavailable");
        const payload = (await response.json()) as SearchResponse;
        if (!abort.signal.aborted && localNumber.current === number) {
          setReviewed(asFoods(payload.foods));
          setLocalCommunity(asFoods(payload.communityFoods));
        }
      } catch {
        // External search stays available; a failed curated lookup is not "no food found".
      } finally {
        if (!abort.signal.aborted && localNumber.current === number) setLocalBusy(false);
      }
    }, 400);
    return () => { clearTimeout(timeout); abort.abort(); };
  }, [query]);

  useEffect(() => () => { externalController.current?.abort(); }, []);

  async function searchAll(term: string) {
    const q = term.trim();
    if (q.length < 3 || q.length > 60 || searching) return;
    const current = ++searchNumber.current;
    externalController.current?.abort();
    const controller = new AbortController();
    externalController.current = controller;
    setSearching(true);
    setCommunity(null);
    setSearchedTerm(q);
    setError("");
    try {
      // Explicit action only. Existing authenticated, rate-limited catalog route.
      const response = await fetch(`/api/food/catalog?q=${encodeURIComponent(q)}`, {
        cache: "no-store", signal: controller.signal,
      });
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Food search is unavailable.");
      if (searchNumber.current === current && !controller.signal.aborted) setCommunity(asFoods(payload.foods));
    } catch (cause) {
      if (searchNumber.current === current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not search the food database.");
      }
    } finally {
      if (searchNumber.current === current) setSearching(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid) void searchAll(searchText);
  }

  function pick(food: CatalogFood, source: string) {
    if (mode === "browse") {
      router.push(`/?mode=barcode&barcode=${encodeURIComponent(food.barcode)}`);
      return;
    }
    if (!onSelect || selected === food.barcode) return;
    onSelect(food, source);
    setSelected(food.barcode);
  }

  const visibleLocalCommunity = localCommunity.filter(food => !reviewed.some(local => local.barcode === food.barcode));
  const visibleCommunity = (community ?? []).filter(food =>
    !reviewed.some(local => local.barcode === food.barcode) &&
    !visibleLocalCommunity.some(local => local.barcode === food.barcode)
  );
  const total = reviewed.length + visibleLocalCommunity.length + visibleCommunity.length;
  const searched = community !== null && searchedTerm !== "";

  function FoodResult({ food, source }: { food: CatalogFood; source: string }) {
    const verified = source === reviewedSource;
    const available = hasNutrients(food);
    return <li className="group rounded-2xl border border-[#e4ebdf] bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-[#fcfefa]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${verified ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
            {verified ? "Reviewed PH label" : source === "Open Food Facts PH-tagged community" ? "PH supermarket · community" : "Open Food Facts · community"}
          </span>
          <h3 className="break-words text-sm font-extrabold text-[#1d3527]">{food.name}</h3>
          <p className="text-xs text-slate-600">{[food.brand, food.servingDescription].filter(Boolean).join(" · ") || "Serving size not available"}</p>
          <p className="font-mono text-[10px] text-slate-500">Barcode {food.barcode}</p>
        </div>
        <button type="button" onClick={() => pick(food, source)}
          disabled={mode === "manual" && selected === food.barcode}
          className="min-h-10 shrink-0 cursor-pointer rounded-xl bg-[#167451] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#105b3f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-default disabled:opacity-60">
          {mode === "browse" ? "Review food" : selected === food.barcode ? "Selected" : mode === "barcode" ? "Choose product" : "Use this food"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 border-t border-[#edf1ea] pt-3">
        {([
          ["Calories", nutrition(food.calories100g, "kcal")],
          ["Protein", nutrition(food.protein100g, "g")],
          ["Carbs", nutrition(food.carbs100g, "g")],
          ["Fat", nutrition(food.fat100g, "g")],
        ] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-[#f5f8f2] p-2">
          <p className="text-[10px] font-medium text-slate-600">{label}</p>
          <p className="mt-0.5 text-xs font-extrabold text-[#1d3527]">{value}</p>
        </div>)}
      </div>
      {!available && <p className="mt-2 text-xs font-medium text-amber-800">Nutrition not listed. You can review the product and fill missing values manually or with Text AI.</p>}
      <p className="mt-2 text-[10px] text-slate-500">Nutrition displayed per 100 g. Check your package label.</p>
    </li>;
  }

  return <section aria-label="Smart food search" className={mode === "browse" ? "space-y-5" : "space-y-3 rounded-2xl border border-[#e2e9db] bg-white p-4 shadow-sm"}>
    <div className={mode === "browse" ? "rounded-3xl border border-[#dae7d5] bg-gradient-to-br from-white via-[#fbfdf8] to-[#eff9e8] p-5 shadow-sm sm:p-7" : "space-y-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-[#183d2b]">{mode === "browse" ? "Search foods & nutrition" : mode === "barcode" ? "Find the exact packaged food" : "Quick food lookup"}</h2>
        <span className="rounded-full bg-[#e4f4dd] px-3 py-1 text-[11px] font-bold text-[#245e3b]">Free · 0 AI credits</span>
      </div>
      <p className="mt-1 text-sm text-[#536a59]">{mode === "browse"
        ? "Find packaged foods from our reviewed Philippine library and the wider community database."
        : mode === "barcode" ? "Type a brand or product name, then choose the exact flavor and size to fill its known nutrition."
        : "Choose a matching product to fill known nutrition fields. Missing values remain unknown."}</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search food, brand or barcode</span>
          <input type="search" value={query} maxLength={60} onChange={event => {setQuery(event.target.value); onQueryChange?.(event.target.value);}}
            placeholder="Try rice, Nissin, tuna, or a brand..." autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-[#c8d9c6] bg-white px-4 py-3 text-sm font-medium text-[#1b3828] outline-none placeholder:text-slate-500 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-200" />
        </label>
        <button type="submit" disabled={!valid || searching}
          className="min-h-12 cursor-pointer rounded-xl bg-[#14794f] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0e5e3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
          {searching ? "Searching..." : "Search foods"}
        </button>
      </form>
      {mode === "browse" && !searchText && <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#536a59]">Try searching</span>
        {popularSearches.map(term => <button key={term} type="button" onClick={() => setQuery(term)}
          className="cursor-pointer rounded-full border border-[#d1dfcb] bg-white px-3 py-1.5 text-xs font-semibold text-[#245d3c] hover:border-emerald-500 hover:bg-emerald-50">{term}</button>)}
      </div>}
      <p className="mt-3 text-[11px] text-[#607464]">Philippine products appear as you type. Search checks additional available foods when needed. No AI credits.</p>
    </div>

    {localBusy && !searched && <p role="status" className="px-1 text-xs text-slate-500">Checking Philippine product matches...</p>}

    {reviewed.length > 0 && <section className="space-y-3" aria-label="Reviewed product suggestions">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-[#183d2b]">Reviewed Philippine products</h3><span className="text-xs text-slate-500">{reviewed.length} found</span></div>
      <ul className="grid gap-3 sm:grid-cols-2">{reviewed.map(food => <FoodResult key={food.barcode} food={food} source={reviewedSource} />)}</ul>
    </section>}

    {visibleLocalCommunity.length > 0 && <section className="space-y-3" aria-label="Philippine supermarket product suggestions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-[#183d2b]">Philippine supermarket matches</h3>
        <span className="text-xs text-slate-500">Community-sourced · Check your package</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">{visibleLocalCommunity.map(food => <FoodResult key={food.barcode} food={food} source="Open Food Facts PH-tagged community" />)}</ul>
    </section>}

    {searching && <div role="status" className="rounded-2xl border border-[#dbe7d8] bg-white p-5 text-sm text-[#536a59]">Searching available food products...</div>}

    {searched && visibleCommunity.length > 0 && <section className="space-y-3" aria-label="Community food search results">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-[#183d2b]">Food results for “{searchedTerm}”</h3>
        <span className="text-xs text-slate-500">{total} product{total === 1 ? "" : "s"} · Community records may be incomplete</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">{visibleCommunity.map(food => <FoodResult key={food.barcode} food={food} source="Open Food Facts" />)}</ul>
    </section>}

    {searched && total === 0 && <section className="rounded-2xl border border-[#e2e9db] bg-white p-5" aria-label="No food results">
      <h3 className="text-sm font-extrabold text-[#183d2b]">No packaged-food results for “{searchedTerm}”</h3>
      <p className="mt-1 text-sm text-slate-600">Try the brand or exact product name. For homemade foods such as cooked rice, use Manual Entry instead of relying on a packaged-food barcode.</p>
      {mode === "browse" && <button type="button" onClick={() => router.push("/?mode=manual")}
        className="mt-3 cursor-pointer rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">Open Manual Food Entry</button>}
    </section>}

    {error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">{error}</div>}
  </section>;
}
