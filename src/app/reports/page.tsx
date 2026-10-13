import Link from "next/link";
import { redirect } from "next/navigation";
import { createWeeklyReport, recentManilaDays, type DatedMeal } from "@/lib/weekly-report";
import { displayMacro } from "@/lib/daily-nutrition";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view your reports."));
  const days = recentManilaDays();
  const firstDay = days[0];
  const [mealsResult, goalsResult] = await Promise.all([
    supabase.from("meals")
      .select("id,consumed_at,total_calories,total_protein,total_carbs,total_fat,analysis_snapshot")
      .eq("user_id", user.id).gte("consumed_at", `${firstDay}T00:00:00+08:00`)
      .order("consumed_at", { ascending: false }).limit(2000),
    supabase.from("fitness_goals")
      .select("calorie_target,protein_target").eq("user_id",user.id).maybeSingle(),
  ]);
  const report = createWeeklyReport((mealsResult.data ?? []) as DatedMeal[], days);
  const calorieTarget = goalsResult.data?.calorie_target ? Number(goalsResult.data.calorie_target) : null;
  const proteinTarget = goalsResult.data?.protein_target ? Number(goalsResult.data.protein_target) : null;
  const maxChart = Math.max(1, calorieTarget ?? 0, ...report.map(day => day.calories));
  return <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
    <header className="my-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Food-only by default</p><h1 className="mt-2 text-3xl font-extrabold">Daily Nutrition Reports</h1><p className="mt-2 text-sm leading-6 text-slate-600">Seven days of saved food intake, grouped by Philippine calendar day. Exercise calories are never subtracted or added to your food target.</p></header>
    {(mealsResult.error || goalsResult.error) && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700">{mealsResult.error ? "Could not load meals for the report." : "Could not load your goals. Run the Phase 5 migration if it isn't installed yet."}</p>}
    {!goalsResult.error && calorieTarget === null && <p className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Want to compare your intake with a daily target? <Link href="/goals" className="font-bold text-emerald-700 underline">Set a personal goal</Link>.</p>}
    {!mealsResult.error && <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold">Calories eaten — last 7 days</h2>
        <p className="mt-1 text-xs text-slate-500">Green bars represent food calories from saved meals. A higher bar is not automatically better or worse.</p>
        <div className="mt-6 grid grid-cols-7 items-end gap-2" role="img" aria-label="Last seven days of calorie intake">
          {report.map(day => <div key={day.date} className="flex min-w-0 flex-col items-center gap-2"><span className="text-[11px] font-semibold text-slate-600">{Math.round(day.calories)}</span><div className="flex h-32 w-full items-end rounded-lg bg-slate-100"><div className="w-full rounded-lg bg-emerald-500" style={{height:`${day.calories > 0 ? Math.max(4, day.calories / maxChart * 100) : 0}%`}} /></div><span className="text-[10px] text-slate-500">{day.date.slice(5)}</span></div>)}
        </div>
        {calorieTarget !== null && <p className="mt-3 text-xs text-slate-600">Your manually entered food target: <strong>{calorieTarget.toLocaleString()} kcal/day</strong>.</p>}
        {(mealsResult.data ?? []).length >= 2000 && <p role="note" className="mt-3 text-xs text-amber-700">You have more than 2,000 meals in this interval. The report may be incomplete.</p>}
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <h2 className="px-5 pt-6 text-lg font-bold sm:px-7">Daily details</h2>
        <p className="px-5 pb-3 text-xs text-slate-500 sm:px-7">Protein may have a + if some meals have unknown macros.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Date (PH)</th><th className="px-5 py-3">Meals</th><th className="px-5 py-3">Calories</th><th className="px-5 py-3">Protein</th><th className="px-5 py-3">Carbs</th><th className="px-5 py-3">Fat</th></tr></thead><tbody>{[...report].reverse().map(day => <tr key={day.date} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold">{day.date}</th><td className="px-5 py-3">{day.mealCount}</td><td className="px-5 py-3">{Math.round(day.calories)} kcal</td><td className="px-5 py-3">{displayMacro(day.protein, day.mealCount)}{proteinTarget ? <span className="block text-[11px] text-slate-400">Goal {proteinTarget} g</span> : null}</td><td className="px-5 py-3">{displayMacro(day.carbs, day.mealCount)}</td><td className="px-5 py-3">{displayMacro(day.fat, day.mealCount)}</td></tr>)}</tbody></table></div>
      </section>
    </>}
  </div></main>;
}
