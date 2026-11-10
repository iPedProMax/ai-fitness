"use client";

import { useState } from "react";

type Day = { date: string; meals: number; calories: number; protein: string; carbs: string; fat: string };
const fmt = (value: number) => Math.round(value).toLocaleString("en-PH");

/** Only stored meal intake; blank days are not assumed to be zero consumption. */
export function ReportExplorer({ days, calorieTarget }: { days: Day[]; calorieTarget: number | null }) {
  const [selected, setSelected] = useState(days[days.length - 1]?.date ?? "");
  const selectedDay = days.find(day => day.date === selected) ?? days[days.length - 1];
  const logged = days.filter(day => day.meals > 0);
  const total = logged.reduce((sum, day) => sum + day.calories, 0);
  const totalMeals = days.reduce((sum, day) => sum + day.meals, 0);
  const average = logged.length ? total / logged.length : null;
  const daysOnTarget = calorieTarget ? logged.filter(day => Math.abs(day.calories - calorieTarget) <= calorieTarget * 0.1).length : null;
  return <section className="mb-6 space-y-5" aria-label="Interactive nutrition report">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Saved meals · 7 days</p><p className="mt-1 text-3xl font-bold text-slate-900">{totalMeals}</p><p className="mt-1 text-xs text-slate-500">{logged.length} of 7 days have logs</p></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Avg. recorded calories</p><p className="mt-1 text-3xl font-bold text-slate-900">{average === null ? "—" : fmt(average)} <span className="text-sm font-normal">kcal</span></p><p className="mt-1 text-xs text-slate-500">Days with logged meals only</p></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Days near your food goal</p><p className="mt-1 text-3xl font-bold text-slate-900">{daysOnTarget === null ? "—" : `${daysOnTarget}/${logged.length}`}</p><p className="mt-1 text-xs text-slate-500">Within ±10% of your goal, logged days only</p></div>
    </div>
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold text-slate-900">Explore a day</h2>
      <p className="mt-1 text-xs text-slate-500">Choose a Philippine calendar day to inspect recorded nutrition. No log does not mean no food eaten.</p>
      <div className="mt-4 grid grid-cols-7 gap-1.5" role="group" aria-label="Select report date">
        {days.map(day => <button key={day.date} type="button" aria-pressed={day.date === selectedDay?.date} onClick={() => setSelected(day.date)} className={`min-w-0 rounded-xl px-1 py-3 text-center text-xs font-semibold focus-visible:outline-2 focus-visible:outline-emerald-500 ${day.date === selectedDay?.date ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-emerald-50"}`}><span className="block">{day.date.slice(5)}</span><span className="mt-1 block text-[10px] font-normal opacity-80">{day.meals ? `${day.meals} log${day.meals === 1 ? "" : "s"}` : "No logs"}</span></button>)}
      </div>
      {selectedDay && <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">{selectedDay.date}</p>
        {selectedDay.meals === 0 ? <p className="mt-2 text-sm text-slate-600">No meals logged for this date.</p> : <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[{label:"Recorded calories",value:`${fmt(selectedDay.calories)} kcal`},{label:"Protein",value:selectedDay.protein},{label:"Carbs",value:selectedDay.carbs},{label:"Fat",value:selectedDay.fat}].map(item=><div key={item.label}><p className="text-xs text-slate-500">{item.label}</p><p className="font-bold text-slate-900">{item.value}</p></div>)}
        </div>}
      </div>}
    </div>
  </section>;
}
