"use client";

import { useMemo, useState } from "react";
import { DeleteActivityButton } from "@/components/delete-activity-button";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from "@/lib/activity";
import {
  filterActivityHistory, groupActivityHistoryByDay,
  type ActivityHistoryRecord, type HistoryPeriod,
} from "@/lib/activity-history";

type Props = {
  activities: ActivityHistoryRecord[];
  showExerciseCalories: boolean;
  loadFailed: boolean;
  nowIso: string;
};

function formatActivityTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeStyle: "short", timeZone: "Asia/Manila",
  }).format(new Date(iso));
}
function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full", timeZone: "Asia/Manila",
  }).format(new Date(`${day}T12:00:00+08:00`));
}

export function ActivityHistoryPanel({ activities, showExerciseCalories, loadFailed, nowIso }: Props) {
  const [query, setQuery] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | "all">("all");
  const [period, setPeriod] = useState<HistoryPeriod>("all");
  const matches = useMemo(() => filterActivityHistory(activities, { query, activityType, period }, new Date(nowIso)),
    [activities, query, activityType, period, nowIso]);
  const grouped = useMemo(() => groupActivityHistoryByDay(matches), [matches]);
  return (
    <section aria-labelledby="activity-history-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="activity-history-title" className="text-xl font-bold">Activity history</h2>
          <p className="mt-1 text-xs text-slate-500">Search and filter your 100 most recent saved workouts · Philippine time</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{activities.length} loaded</span>
      </div>
      {!loadFailed && activities.length > 0 && (
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Search saved activities
            <input
              type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Type, intensity, or notes" aria-label="Search saved activities"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-500"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Workout type
              <select aria-label="Filter by workout type" value={activityType} onChange={event => setActivityType(event.target.value as ActivityType | "all")}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
                <option value="all">All types</option>
                {ACTIVITY_TYPES.map(type => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Date range
              <select aria-label="Filter by date range" value={period} onChange={event => setPeriod(event.target.value as HistoryPeriod)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
                <option value="all">All loaded logs</option>
                <option value="7">Last 7 PH days</option>
                <option value="30">Last 30 PH days</option>
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500" role="status">Showing {matches.length} of {activities.length} loaded activities</p>
            {(query || activityType !== "all" || period !== "all") && (
              <button type="button" onClick={() => { setQuery(""); setActivityType("all"); setPeriod("all"); }}
                className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Clear filters</button>
            )}
          </div>
        </div>
      )}
      {loadFailed ? (
        <div role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load your activities. Check your connection or try again.</div>
      ) : activities.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-3xl" aria-hidden="true">🏋️</p>
          <p className="mt-3 font-semibold">No activities saved yet</p>
          <p className="mt-1 text-sm text-slate-500">Your first workout will appear here.</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-600">No matching activities in your loaded history. Try changing the filters.</div>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map(group => (
            <div key={group.date}>
              <h3 className="sticky top-[76px] z-10 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">{formatDay(group.date)}</h3>
              <ul className="divide-y divide-slate-100">
                {group.entries.map(item => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{ACTIVITY_LABELS[item.activity_type] ?? "Activity"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatActivityTime(item.performed_at)} · {item.duration_minutes} min · {item.intensity}</p>
                      {showExerciseCalories && (
                        <p className="mt-2 text-sm font-bold text-emerald-700">
                          {item.calories_burned === null ? "Calories not provided" : `${Math.round(Number(item.calories_burned)).toLocaleString()} kcal`}
                          <span className="ml-2 text-xs font-normal text-slate-500">{item.calorie_source === "estimated" ? "estimated" : item.calorie_source === "reported" ? "from your entry" : ""}</span>
                        </p>
                      )}
                      {item.notes && <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.notes}</p>}
                    </div>
                    <DeleteActivityButton id={item.id} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {!loadFailed && activities.length >= 100 && (
        <p role="note" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Only your 100 newest activities are loaded. Search and date filters apply to those 100 records, not your complete lifetime history.
        </p>
      )}
    </section>
  );
}