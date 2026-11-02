import Link from "next/link";
import { ReportExplorer } from "@/components/report-explorer";
import { redirect } from "next/navigation";
import { createWeeklyReport, recentManilaDays, type DatedMeal } from "@/lib/weekly-report";
import { displayMacro } from "@/lib/daily-nutrition";
import { ReportsSevenDayOverview } from "@/components/reports-seven-day-overview";
import { ReportsInteractiveChart } from "@/components/reports-interactive-chart";
import { createClient } from "@/lib/supabase/server";
import { ReportsAdvancedNutrition } from "@/components/reports-advanced-nutrition";
import { buildAdvancedNutritionReport } from "@/lib/advanced-nutrition-report";
import type { ReportMeal } from "@/lib/report-meal-details";
import { ReportsDailyView } from "@/components/reports-daily-view";
import { resolveReportView, resolveReportDate } from "@/lib/report-views";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string; day?: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view your reports."));
  const days = recentManilaDays();
  const params = await searchParams;
  const view = resolveReportView(params.view);
  const selectedDate = resolveReportDate(days, params.day);
  const firstDay = days[0];
  const [mealsResult, goalsResult] = await Promise.all([
    supabase.from("meals")
      .select("id,consumed_at,total_calories,total_protein,total_carbs,total_fat,analysis_snapshot,notes,meal_items(id,name,estimated_grams,calories,protein,carbs,fat)")
      .eq("user_id", user.id).gte("consumed_at", `${firstDay}T00:00:00+08:00`)
      .order("consumed_at", { ascending: false }).limit(2000),
    supabase.from("fitness_goals")
      .select("calorie_target,protein_target").eq("user_id",user.id).maybeSingle(),
  ]);
  const report = createWeeklyReport((mealsResult.data ?? []) as DatedMeal[], days);
  const calorieTarget = goalsResult.data?.calorie_target ? Number(goalsResult.data.calorie_target) : null;
  const proteinTarget = goalsResult.data?.protein_target ? Number(goalsResult.data.protein_target) : null;
  
  return <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
    <header className="my-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Food-only by default</p><h1 className="mt-2 text-3xl font-extrabold">Reports</h1><p className="mt-2 text-sm leading-6 text-slate-600">Switch between a daily food log and your rolling seven-day nutrition overview. All dates use Philippine time. Exercise calories are kept separate.</p></header>
    <nav aria-label="Report views" className="mb-6 flex w-fit flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <Link href="/reports?view=daily" aria-current={view === "daily" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl px-5 py-2.5 text-sm font-bold transition ${view === "daily" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>Daily</Link>
      <Link href="/reports?view=weekly" aria-current={view === "weekly" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl px-5 py-2.5 text-sm font-bold transition ${view === "weekly" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>Weekly · Last 7 days</Link>
    </nav>
    <ReportsAdvancedNutrition days={buildAdvancedNutritionReport((mealsResult.data ?? []) as DatedMeal[], days)} view={view} selectedDate={selectedDate} truncated={(mealsResult.data ?? []).length >= 2000} />
    {(mealsResult.error || goalsResult.error) && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700">{mealsResult.error ? "Could not load meals for the report." : "Could not load your goals. Run the Phase 5 migration if it isn't installed yet."}</p>}
    {!goalsResult.error && calorieTarget === null && <p className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Want to compare your intake with a daily target? <Link href="/goals" className="font-bold text-emerald-700 underline">Set a personal goal</Link>.</p>}
    {!mealsResult.error && (view === "weekly" ? <>
      <ReportsSevenDayOverview report={report} calorieTarget={calorieTarget} proteinTarget={proteinTarget} truncated={(mealsResult.data ?? []).length >= 2000} />
      <ReportExplorer days={report.map(day => ({ date: day.date, meals: day.mealCount, calories: day.calories, protein: displayMacro(day.protein, day.mealCount), carbs: displayMacro(day.carbs, day.mealCount), fat: displayMacro(day.fat, day.mealCount) }))} calorieTarget={calorieTarget} />
      <ReportsInteractiveChart report={report} calorieTarget={calorieTarget} />
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <h2 className="px-5 pt-6 text-lg font-bold sm:px-7">Daily details</h2>
        <p className="px-5 pb-3 text-xs text-slate-500 sm:px-7">Protein may have a + if some meals have unknown macros.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Date (PH)</th><th className="px-5 py-3">Meals</th><th className="px-5 py-3">Calories</th><th className="px-5 py-3">Protein</th><th className="px-5 py-3">Carbs</th><th className="px-5 py-3">Fat</th></tr></thead><tbody>{[...report].reverse().map(day => <tr key={day.date} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold">{day.date}</th><td className="px-5 py-3">{day.mealCount}</td><td className="px-5 py-3">{day.mealCount > 0 ? `${Math.round(day.calories)} kcal` : "Not logged"}</td><td className="px-5 py-3">{day.mealCount > 0 ? displayMacro(day.protein, day.mealCount) : "Not logged"}{day.mealCount > 0 && proteinTarget ? <span className="block text-[11px] text-slate-400">Goal {proteinTarget} g</span> : null}</td><td className="px-5 py-3">{day.mealCount > 0 ? displayMacro(day.carbs, day.mealCount) : "Not logged"}</td><td className="px-5 py-3">{day.mealCount > 0 ? displayMacro(day.fat, day.mealCount) : "Not logged"}</td></tr>)}</tbody></table></div>
      </section>
    </> : <ReportsDailyView report={report} selectedDate={selectedDate} meals={(mealsResult.data ?? []) as ReportMeal[]} calorieTarget={calorieTarget} proteinTarget={proteinTarget} truncated={(mealsResult.data ?? []).length >= 2000} />)}
  </div></main>;
}
