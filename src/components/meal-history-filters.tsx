import Link from "next/link";
import { mealHistoryHref, type MealHistoryView } from "@/lib/meal-history-browse";

export function MealHistoryFilters({ view }: { view: MealHistoryView }) {
  return <section aria-label="Find meals" className="mt-7 rounded-2xl border border-[#dce7d8] bg-white p-4 shadow-sm sm:p-5">
    <form action="/meals" method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-end">
      <label className="block text-xs font-bold text-[#194d34]">Search saved foods
        <input type="search" name="q" maxLength={80} defaultValue={view.term}
          placeholder="e.g. Pancit Bihon or grilled steak"
          className="mt-1.5 w-full rounded-xl border border-[#dce7d8] bg-[#f8faf6] px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
      </label>
      <label className="block text-xs font-bold text-[#194d34]">Date filter
        <select name="period" defaultValue={view.mode} className="mt-1.5 w-full rounded-xl border border-[#dce7d8] bg-[#f8faf6] px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
          <option value="recent">Recent logged days</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="date">Specific date</option>
          <option value="range">Custom date range</option>
        </select>
      </label>
      <button type="submit" className="min-h-11 rounded-xl bg-[#176141] px-5 py-3 text-sm font-bold text-white hover:bg-[#104a32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Find meals</button>
      <div className="grid gap-3 sm:col-span-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">Specific date (PH)
          <input type="date" name="date" defaultValue={view.date} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">From (custom range)
          <input type="date" name="from" defaultValue={view.from} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">To (custom range)
          <input type="date" name="to" defaultValue={view.to} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
      </div>
    </form>
    <div aria-label="Quick date filters" className="mt-4 flex flex-wrap gap-2">
      {(["recent", "week", "month"] as const).map(mode => <Link key={mode}
        href={mealHistoryHref(view, { mode, days: 3 })}
        aria-current={view.mode === mode ? "page" : undefined}
        className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${view.mode === mode ? "border-[#176141] bg-[#176141] text-white" : "border-[#dce7d8] bg-[#f6f9f3] text-[#245941] hover:border-[#176141]"}`}>
        {mode === "recent" ? "Recent" : mode === "week" ? "Last 7 days" : "Last 30 days"}
      </Link>)}
      {(view.term || view.mode !== "recent") && <Link href="/meals" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear filters</Link>}
    </div>
    <p className="mt-3 text-xs text-slate-500">Results use Philippine eating dates. Search covers older saved food names, not just meals currently on screen.</p>
  </section>;
}

export function MealHistoryLoadMore({ view, hasMore, truncated }: { view: MealHistoryView; hasMore: boolean; truncated: boolean }) {
  if (truncated) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your history has many entries. Narrow the date or food search to view more results.</p>;
  if (!hasMore) return null;
  if (view.days >= 60) return <p className="text-center text-xs text-slate-500">Select a date range to browse further back.</p>;
  return <div className="py-3 text-center">
    <Link href={mealHistoryHref(view, { days: Math.min(60, view.days + 3) })}
      className="inline-flex min-h-11 items-center rounded-xl border border-[#c9dec5] bg-white px-6 py-3 text-sm font-bold text-[#176141] shadow-sm hover:bg-[#f5faf2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
      Load 3 more logged days
    </Link>
  </div>;
}
