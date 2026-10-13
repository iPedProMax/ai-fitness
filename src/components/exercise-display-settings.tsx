"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExerciseDisplayPreference } from "@/app/settings/actions";

export function ExerciseDisplaySettings({
  initialShowExerciseCalories,
}: {
  initialShowExerciseCalories: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialShowExerciseCalories);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle() {
    if (pending) return;
    const next = !enabled;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveExerciseDisplayPreference(next);
        if (!result.ok) { setError(result.message); return; }
        setEnabled(next);
        setSaved(true);
        router.refresh();
      } catch {
        setError("Could not save your preference. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby="exercise-preference-heading" className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 id="exercise-preference-heading" className="text-xl font-bold">Exercise & calorie display</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Only interested in tracking food? You can hide calorie-burn numbers while keeping your workouts saved.</p>
      <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
        <div>
          <p id="exercise-calories-label" className="font-semibold">Show calories burned</p>
          <p id="exercise-calories-description" className="mt-1 text-xs leading-5 text-slate-500">When on, show exercise calories on the dashboard and Activities page. When off, focus on calories eaten.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="exercise-calories-label"
          aria-describedby="exercise-calories-description"
          aria-busy={pending}
          disabled={pending}
          onClick={toggle}
          className="shrink-0 font-bold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-60"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 88,
            minHeight: 42,
            padding: "8px 14px",
            borderRadius: 12,
            border: `2px solid ${enabled ? "#047857" : "#94a3b8"}`,
            backgroundColor: enabled ? "#047857" : "#e2e8f0",
            color: enabled ? "#ffffff" : "#0f172a",
          }}
        >
          {pending ? "Saving…" : enabled ? "ON" : "OFF"}
        </button>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">Current focus: {enabled ? "Food + exercise" : "Food intake only"}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">This controls what you see, not what is stored. Your workout history remains saved. No AI credits are used.</p>
      {pending && <p role="status" className="mt-3 text-sm text-slate-600">Saving your preference…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && !pending && <p role="status" className="mt-3 text-sm text-emerald-700">Preference saved.</p>}
    </section>
  );
}
