import Link from "next/link";
import { displayMacro } from "@/lib/daily-nutrition";
import { mealsForReportDay } from "@/lib/report-views";
import { formatReportDate } from "@/lib/report-date-format";
import type { createWeeklyReport } from "@/lib/weekly-report";
import { DailyMealDetails } from "@/components/reports-daily-meal-details";
import type { ReportMeal } from "@/lib/report-meal-details";

type ReportDay = ReturnType<typeof createWeeklyReport>[number];
type Props = {
  report: readonly ReportDay[];
  selectedDate: string;
  meals: readonly ReportMeal[];
  calorieTarget: number | null;
  proteinTarget: number | null;
  truncated: boolean;
};

function readable(value: number): string {
  return Math.round(value).toLocaleString("en-PH");
}



export function ReportsDailyView({ report, selectedDate, meals, calorieTarget, proteinTarget, truncated }: Props) {
  const day = report.find(item => item.date === selectedDate);
  if (!day) return <p role="alert">This day is outside your available seven-day report.</p>;
  const saved = mealsForReportDay(meals, selectedDate) as ReportMeal[];
  const hasLog = day.mealCount > 0;
  const today = report.at(-1)?.date;
  const cards = [
    { label: "Calories logged", value: hasLog ? `${readable(day.calories)} kcal` : "No log" },
    { label: "Protein logged", value: hasLog ? displayMacro(day.protein, day.mealCount) : "Not logged" },
    { label: "Carbs logged", value: hasLog ? displayMacro(day.carbs, day.mealCount) : "Not logged" },
    { label: "Fat logged", value: hasLog ? displayMacro(day.fat, day.mealCount) : "Not logged" },
  ];
  return (
    <section aria-label="Daily nutrition report" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Daily food report</p>
      <h2 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">{formatReportDate(day.date)} {day.date === today ? "· Today" : ""}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Choose any of the last seven Philippine calendar days. Figures reflect saved food entries only, not everything you necessarily ate.</p>
      <nav aria-label="Choose a day for your daily report" className="mt-5 flex flex-wrap gap-2">
        {report.map(item => (
          <Link key={item.date} href={`/reports?view=daily&day=${encodeURIComponent(item.date)}`}
            aria-current={item.date === selectedDate ? "date" : undefined}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3 py-2 text-xs font-bold transition ${item.date === selectedDate ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
            {item.date === today ? "Today" : item.date.slice(5)}
          </Link>
        ))}
      </nav>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className="mt-2 text-xl font-extrabold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
      {hasLog ? (
        <>
          <p className="mt-5 text-sm text-slate-600">{day.mealCount} saved meal {day.mealCount === 1 ? "entry" : "entries"} on this date.
            {calorieTarget !== null ? ` Logged ${readable(day.calories)} of your ${readable(calorieTarget)} kcal daily food target.` : ""}
            {proteinTarget !== null ? ` Your protein goal is ${readable(proteinTarget)} g/day.` : ""}
          </p>
          {(day.protein.incomplete || day.carbs.incomplete || day.fat.incomplete) && (
            <p role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">One or more saved meals have unknown macros. A + denotes the amount recorded, not necessarily the full amount eaten.</p>
          )}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <h3 className="px-4 pt-4 text-base font-bold text-slate-900">Meals saved that day</h3>
            <p className="px-4 pb-3 text-xs text-slate-500">Tap a meal to expand its saved foods, nutrients, and notes.</p>
            <ul className="divide-y divide-slate-200">
              {saved.map((meal) => (
                <DailyMealDetails key={meal.id} meal={meal} />
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">A complete food diary depends on logging all meals. Exercise calories are not deducted from the food target.</p>
          <Link href="/meals" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-emerald-700 hover:underline">Open Meal History →</Link>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-900">No meals logged for this day</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">This does not mean you ate zero calories. This date is excluded from logged-day averages.</p>
          <Link href="/" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-emerald-700 hover:underline">Log food →</Link>
        </div>
      )}
      {truncated && <p role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The seven-day query reached 2,000 records. This daily report may be incomplete.</p>}
    </section>
  );
}