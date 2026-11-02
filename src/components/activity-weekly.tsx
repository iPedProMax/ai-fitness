type Day = { date: string; logs: number; minutes: number; calories: number };
export function ActivityWeekly({ days, showExerciseCalories, truncated = false }: { days: Day[]; showExerciseCalories: boolean; truncated?: boolean }) {
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const activeDays = days.filter(day => day.logs > 0).length;
  const maxMinutes = Math.max(1, ...days.map(day => day.minutes));
  return <section aria-labelledby="activity-week-heading" className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <h2 id="activity-week-heading" className="text-xl font-bold text-slate-900">Your last 7 days of movement</h2>
    <p className="mt-1 text-sm text-slate-500">{totalMinutes.toLocaleString()} logged minutes · {activeDays} active logging day{activeDays === 1 ? "" : "s"}</p>
    <div className="mt-5 grid grid-cols-7 items-end gap-2" role="img" aria-label="Daily recorded exercise duration over the past seven Philippine calendar days">
      {days.map(day => <div key={day.date} className="flex min-w-0 flex-col items-center gap-1.5"><span className="text-[11px] font-bold text-slate-700">{day.minutes}</span><div className="flex h-24 w-full items-end rounded-xl bg-slate-100"><div className="w-full rounded-xl bg-emerald-500" style={{height:`${day.minutes ? Math.max(5,day.minutes/maxMinutes*100) : 0}%`}} /></div><span className="text-[10px] text-slate-500">{day.date.slice(5)}</span></div>)}
    </div>
    {showExerciseCalories && <p className="mt-3 text-xs text-slate-600">Logged exercise calories: {Math.round(days.reduce((sum,day)=>sum+day.calories,0)).toLocaleString()} kcal. Estimates are not subtracted from food intake.</p>}
    <p className="mt-2 text-xs text-slate-500">Days without records are not evidence of inactivity.</p>
    {truncated && <p role="note" className="mt-2 text-xs text-amber-700">Over 500 activities were recorded. This summary may be incomplete.</p>}
  </section>;
}
