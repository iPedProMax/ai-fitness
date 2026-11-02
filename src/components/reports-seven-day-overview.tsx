import Link from "next/link";
import type { createWeeklyReport } from "@/lib/weekly-report";
import { summarizeSevenDayOverview } from "@/lib/report-insights";

type ReportDay = ReturnType<typeof createWeeklyReport>[number];

type Props = {
  report: readonly ReportDay[];
  calorieTarget: number | null;
  proteinTarget: number | null;
  truncated: boolean;
};

function formatted(value: number): string {
  return Math.round(value).toLocaleString("en-PH");
}

export function ReportsSevenDayOverview({ report, calorieTarget, proteinTarget, truncated }: Props) {
  const overview = summarizeSevenDayOverview(report);
  const days = overview.calendarDays;
  const cards = [
    {
      label: "Days with meal logs",
      value: `${overview.daysWithMeals} / ${days}`,
      context: `${overview.daysWithoutMeals} day${overview.daysWithoutMeals === 1 ? "" : "s"} with no saved meals`,
    },
    {
      label: "Meals logged",
      value: formatted(overview.mealCount),
      context: "From your saved food entries",
    },
    {
      label: "Average on logged days",
      value: truncated ? "Partial" : overview.averageCaloriesOnLoggedDays === null
        ? "Not enough data" : `${formatted(overview.averageCaloriesOnLoggedDays)} kcal`,
      context: overview.daysWithMeals ? `Calculated across ${overview.daysWithMeals} logged day${overview.daysWithMeals === 1 ? "" : "s"} only` : "Log a meal to start your average",
    },
    {
      label: "Average protein on logged days",
      value: truncated ? "Partial" : overview.averageProteinOnLoggedDays === null
        ? "Incomplete" : `${overview.averageProteinOnLoggedDays.toFixed(1)} g`,
      context: overview.daysWithMeals === 0 ? "No protein logs yet"
        : overview.averageProteinOnLoggedDays === null ? "Some meal entries have unknown protein" : "Based on recorded protein, not an AI guess",
    },
  ];

  return (
    <section aria-label="Seven-day nutrition overview" className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your week in food</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Seven-day overview</h2>
          <p className="mt-1 text-xs text-slate-500">Based on saved food logs, in Philippine calendar days.</p>
        </div>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Log a meal</Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">{card.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{card.context}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
        <p><strong className="text-slate-900">Today:</strong> {overview.todayHasMeals
          ? `${formatted(overview.todayCalories ?? 0)} kcal from meals logged so far`
          : "No meals logged yet"}.
          {calorieTarget !== null ? ` Your chosen target is ${formatted(calorieTarget)} kcal/day.` : ""}
        </p>
        {proteinTarget !== null && <p>Your chosen protein target is {formatted(proteinTarget)} g/day. Reported protein may be incomplete.</p>}
        <p className="text-xs text-slate-500"><strong>Important:</strong> No log does not mean you ate zero. Averages exclude unlogged days, and partial meal logging can understate actual intake.</p>
        {overview.daysWithIncompleteMacros > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">Protein, carbs, or fat were left unknown on {overview.daysWithIncompleteMacros} logged day{overview.daysWithIncompleteMacros === 1 ? "" : "s"}. Check individual food entries before comparing macros.</p>}
        {truncated && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">At least 2,000 meals were returned, which reaches this report's query limit. Weekly totals and averages may be incomplete.</p>}
      </div>
    </section>
  );
}