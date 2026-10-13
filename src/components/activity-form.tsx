"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveActivity } from "@/app/activities/actions";
import {
  ACTIVITY_LABELS, ACTIVITY_TYPES, INTENSITIES, activityCalories,
  type ActivityType, type Intensity,
} from "@/lib/activity";

function localDatetimeValue(date: Date): string {
  const padded = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}T${padded(date.getHours())}:${padded(date.getMinutes())}`;
}

const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const labelClass = "text-sm font-semibold text-slate-700";

export function ActivityForm({ showExerciseCalories = false }: { showExerciseCalories?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activityType, setActivityType] = useState<ActivityType>("walking");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [minutes, setMinutes] = useState("30");
  const [weight, setWeight] = useState("");
  const [reportedCalories, setReportedCalories] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => setWhen(localDatetimeValue(new Date())), []);

  const durationMinutes = Number(minutes);
  const weightKg = weight.trim() === "" ? null : Number(weight);
  const reported = reportedCalories.trim() === "" ? null : Number(reportedCalories);
  const canPreview = Number.isInteger(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 720 &&
    (weightKg === null || (Number.isFinite(weightKg) && weightKg >= 20 && weightKg <= 500));
  const preview = canPreview ? activityCalories({
    activityType, intensity, durationMinutes, weightKg,
    reportedCalories: reported !== null && Number.isFinite(reported) && reported >= 0 && reported <= 10_000 ? reported : null,
    performedAt: new Date().toISOString(), notes,
  }) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSuccess(false);
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) {
      setFeedback("Choose a valid date and time.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveActivity({
          activityType, intensity, durationMinutes,
          weightKg,
          reportedCalories: reported,
          performedAt: date.toISOString(), notes,
        });
        if (!result.ok) {
          setFeedback(result.message);
          return;
        }
        setSuccess(true);
        setNotes("");
        setReportedCalories("");
        router.refresh();
      } catch {
        setFeedback("Could not save your activity. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Log an activity</h2>
          <p className="mt-1 text-sm text-slate-500">Manual logging never uses AI credits.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Free · 0 AI credits</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Exercise type
          <select className={fieldClass} value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Intensity
          <select className={fieldClass} value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)}>
            {INTENSITIES.map((level) => <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Duration (minutes)
          <input className={fieldClass} type="number" min="1" max="720" step="1" required value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className={labelClass}>
          Body weight (kg) <span className="font-normal text-slate-400">optional</span>
          <input className={fieldClass} type="number" min="20" max="500" step="0.1" placeholder={showExerciseCalories ? "For calorie estimate" : "Optional, for activity log"} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className={labelClass}>
          When you exercised
          <input className={fieldClass} type="datetime-local" required value={when} max={localDatetimeValue(new Date(Date.now() + 5 * 60_000))} onChange={(e) => setWhen(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">Uses your device&apos;s local time.</span>
        </label>
        <label className={labelClass}>
          Calories from watch <span className="font-normal text-slate-400">optional</span>
          <input className={fieldClass} type="number" min="0" max="10000" step="0.1" placeholder="Overrides formula estimate if entered" value={reportedCalories} onChange={(e) => setReportedCalories(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">You can save watch calories even when calorie displays are hidden in Settings.</span>
        </label>
      </div>

      <label className={`block ${labelClass}`}>
        Notes <span className="font-normal text-slate-400">optional</span>
        <textarea className={fieldClass} rows={2} maxLength={280} placeholder="e.g. Treadmill, easy pace, upper-body day" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {showExerciseCalories && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Calories burned</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900" aria-live="polite">
          {preview?.caloriesBurned !== null && preview?.caloriesBurned !== undefined
            ? `${Math.round(preview.caloriesBurned).toLocaleString()} kcal`
            : "Add your weight to estimate"}
        </p>
        <p className="mt-1 text-xs leading-5 text-emerald-900/80">
          {preview?.calorieSource === "reported"
            ? "User-reported value from your watch or equipment."
            : "Formula-based gross calorie estimate (MET), not an exact measurement. Intensity is approximate; calories can vary substantially."}
        </p>
      </div>}

      {feedback && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{feedback}</p>}
      {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Activity saved! Your history has been refreshed.</p>}
      <button type="submit" disabled={pending || !when} className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Saving activity…" : "Save activity"}
      </button>
    </form>
  );
}
