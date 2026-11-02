import { summarizeActivityWeek, type WeeklyActivityRecord } from "@/lib/activity-weekly-insights";

type Props = {
  activities: readonly WeeklyActivityRecord[];
  now: Date;
  showExerciseCalories: boolean;
  truncated: boolean;
  loadFailed: boolean;
};

function readable(number: number): string {
  return Math.round(number).toLocaleString("en-PH");
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "Asia/Manila" })
    .format(new Date(`${date}T12:00:00+08:00`));
}

export function ActivityWeeklyOverview({
  activities, now, showExerciseCalories, truncated, loadFailed,
}: Props) {
  const week = summarizeActivityWeek(activities, now);
  const maxMinutes = Math.max(1, ...week.days.map(day => day.minutes));

  return (
    <section aria-labelledby="khalories-activity-week-title" className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Last 7 Philippine calendar days</p>
          <h2 id="khalories-activity-week-title" className="mt-1 text-xl font-bold text-slate-900">Your activity overview</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Based on saved exercise logs, not a measurement of everything you did. A day without entries does not necessarily mean you were inactive.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Free activity tracking</span>
      </div>

      {loadFailed ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Activity history could not be loaded. The weekly overview is unavailable.</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { title: "Sessions logged", value: readable(week.sessions), unit: "workouts" },
              { title: "Minutes logged", value: readable(week.minutes), unit: "minutes" },
              { title: "Days with logs", value: `${week.activeLoggedDays}/7`, unit: "days" },
              { title: "Avg. session length", value: week.sessions ? readable(week.minutes / week.sessions) : "—", unit: "minutes" },
            ].map(metric => (
              <div key={metric.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">{metric.title}</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.unit}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-900">Minutes recorded each day</h3>
            <div role="list" aria-label="Seven days of recorded activity minutes" className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-3">
              {week.days.map(day => (
                <div key={day.date} role="listitem" className="min-w-0 text-center" aria-label={`${day.date}: ${day.sessions ? `${readable(day.minutes)} minutes across ${day.sessions} logs` : "no activities logged"}`}>
                  <p className="truncate text-[10px] font-semibold text-slate-600 sm:text-xs">{day.sessions ? readable(day.minutes) : "—"}</p>
                  <div className="mt-2 flex h-28 items-end overflow-hidden rounded-lg bg-slate-100 sm:h-36" aria-hidden="true">
                    {day.sessions > 0 && (
                      <div className="w-full rounded-t-lg bg-emerald-500" style={{ height: `${day.minutes > 0 ? Math.max(4, day.minutes / maxMinutes * 100) : 0}%` }} />
                    )}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-slate-700 sm:text-xs">{dayLabel(day.date)}</p>
                  <p className="truncate text-[9px] text-slate-500 sm:text-[11px]">{day.date.slice(5)}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500 sm:text-[11px]">{day.sessions ? `${day.sessions} log${day.sessions === 1 ? "" : "s"}` : "No log"}</p>
                </div>
              ))}
            </div>
          </div>

          {showExerciseCalories && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
              <strong className="text-slate-900">Recorded exercise energy:</strong> {week.sessions ? `${readable(week.knownCalories)} kcal` : "No logs"}.
              {week.missingCalorieCount > 0 && ` Calories were not provided for ${week.missingCalorieCount} activity log${week.missingCalorieCount === 1 ? "" : "s"}; the total is incomplete.`}
              <p className="mt-1 text-xs leading-5 text-slate-600">Values may be user-reported or rough gross-calorie estimates. Exercise calories do not change your food calorie target.</p>
            </div>
          )}
          {truncated && (
            <p role="note" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              This page loads only your 100 most recent activities. Weekly totals and daily bars may be incomplete if additional entries exist.
            </p>
          )}
          {week.sessions === 0 && <p className="mt-4 text-sm text-slate-600">No activity entries were saved in this seven-day window. You can add one using the form below.</p>}
        </>
      )}
    </section>
  );
}