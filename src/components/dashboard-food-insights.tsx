import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  buildDashboardFoodInsights, phFoodDayKey,
  type DashboardFoodRecord, type RecordedAmount,
} from "@/lib/dashboard-food-insights";

function coverage(label: string, amount: RecordedAmount, unit: string): string {
  if (!amount.known) return `${label}: Unknown`;
  const total = Number(amount.total.toFixed(1)).toLocaleString("en-PH", { maximumFractionDigits: 1 });
  return `${label}: ${total} ${unit}${amount.missing ? " + (partial)" : ""}`;
}

/** Read-only, account-scoped, informational feedback; no medical diagnosis. */
export async function DashboardFoodInsights() {
  const today = phFoodDayKey(new Date());
  let meals: DashboardFoodRecord[] = [];
  let queryError = false;
  let truncated = false;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;
    const result = await supabase.from("meals")
      .select("id,consumed_at,analysis_snapshot")
      .eq("user_id", user.id)
      .gte("consumed_at", `${today}T00:00:00+08:00`)
      .order("consumed_at", { ascending: false }).limit(200);
    queryError = Boolean(result.error);
    meals = (result.data ?? []) as unknown as DashboardFoodRecord[];
    truncated = meals.length >= 200;
  } catch {
    queryError = true;
  }

  if (queryError) {
    return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="food-insight-title">
      <h2 id="food-insight-title" className="text-lg font-bold">Food &amp; nutrition insights</h2>
      <p role="status" className="mt-2 text-sm text-slate-600">Insights are temporarily unavailable. Your saved meals are unaffected.</p>
    </section>;
  }

  const summary = buildDashboardFoodInsights(meals, today);
  const missing = summary.sodium.missing + summary.addedSugar.missing + summary.unknownFoodRows;
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="food-insight-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Based on your saved food log</p>
        <h2 id="food-insight-title" className="mt-2 text-xl font-extrabold text-slate-900">Food &amp; nutrition insights</h2>
        <p className="mt-1 text-xs text-slate-500">Today in Philippine time. Helpful reminders, not medical alerts or a diagnosis.</p>
      </div>
      <Link href="/reports?view=daily" className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700">Daily nutrition report</Link>
    </div>
    {summary.todayMeals === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No food logs for today. Save a meal to see recorded-nutrient insights. This does not mean you ate nothing.</p> : <>
      <p className="mt-3 text-xs text-slate-500">{summary.todayMeals} saved meal{summary.todayMeals === 1 ? "" : "s"} reviewed</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {summary.notices.length ? summary.notices.map(item => <article key={item.id} className={`rounded-2xl border p-4 ${item.category === "context" ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}>
          <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-700">{item.description}</p>
        </article>) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
          <p className="text-sm font-semibold">No specific flags from today's available records</p>
          <p className="mt-1 text-xs text-slate-600">This is not a medical clearance or proof that your diet is low in sugar, sodium or purines.</p>
        </div>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-lg bg-slate-50 px-3 py-2">{coverage("Added sugar", summary.addedSugar, "g")}</span>
        <span className="rounded-lg bg-slate-50 px-3 py-2">{coverage("Sodium", summary.sodium, "mg")}</span>
      </div>
      {(missing > 0 || truncated) && <p className="mt-3 text-xs text-amber-800" role="note">
        Some nutrient values are missing{truncated ? " or the latest-200-meals query is capped" : ""}. Recorded totals are incomplete, not confirmed daily intake.
      </p>}
    </>}
    <p className="mt-4 text-xs leading-5 text-slate-500">Added sugar is different from total sugar. Purine reminders use food names, not measurements of purines or blood uric acid. Values may be user-entered or AI-transcribed; check labels and serving sizes. The general 20% Daily Value guide may not match your personal needs.</p>
    <div className="mt-2 flex flex-wrap gap-3 text-xs">
      <a className="font-semibold text-emerald-700 underline" href="https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels" target="_blank" rel="noreferrer">FDA nutrition-label guidance</a>
      <a className="font-semibold text-emerald-700 underline" href="https://rheumatology.org/patients/gout" target="_blank" rel="noreferrer">ACR guidance about gout</a>
    </div>
  </section>;
}
