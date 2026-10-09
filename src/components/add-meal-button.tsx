"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { saveMeal } from "@/app/meals/actions";
import { localMealTimeToIso } from "@/lib/meal-time-input";

type Props = { analysis: FoodAnalysis };

export function AddMealButton({ analysis }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState<FoodAnalysis | null>(null);
  const [mode, setMode] = useState<"now" | "custom">("now");
  const [mealDate, setMealDate] = useState("");
  const [mealClock, setMealClock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSaved = savedAnalysis === analysis;

  useEffect(() => {
    // A newly analyzed meal should start with a fresh confirmation.
    setMode("now");
    setMealDate("");
    setMealClock("");
    setError(null);
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [analysis]);

  function openConfirmation() {
    if (isSaving || isSaved) return;
    setError(null);
    setMode("now");
    setMealDate("");
    setMealClock("");
    dialogRef.current?.showModal();
  }

  async function confirmSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || isSaved) return;
    const consumedAt = mode === "now"
      ? undefined
      : localMealTimeToIso(mealDate, mealClock);
    if (consumedAt === null) {
      setError("Choose a valid past eating date and time.");
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveMeal(analysis, consumedAt);
      if (result.ok) {
        setSavedAnalysis(analysis);
        dialogRef.current?.close();
        return;
      }
      if (result.code === "UNAUTHENTICATED") {
        window.location.assign("/auth/login?message=" + encodeURIComponent("Sign in to save your meal."));
        return;
      }
      setError(result.message);
    } catch {
      setError("Something went wrong while saving. Please try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={openConfirmation} disabled={isSaving || isSaved} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
        {isSaved ? "Saved!" : "Add Meal"}
      </button>
      {isSaved && <p role="status" className="text-xs text-emerald-700">Meal saved successfully.</p>}
      <dialog ref={dialogRef} aria-labelledby="meal-confirm-title" className="m-auto w-[min(92vw,440px)] max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 max-sm:mt-auto max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none">
        <form onSubmit={confirmSave} className="space-y-4 p-5 sm:p-6">
          <h2 id="meal-confirm-title" className="text-xl font-bold">Save your meal</h2>
          <p className="text-sm text-slate-500">When did you eat this food?</p>
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Meal total: {Math.round(analysis.totalCalories)} kcal</div>
          <fieldset className="space-y-3">
            <legend className="sr-only">Eating time</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="eaten-at" checked={mode === "now"} onChange={() => setMode("now")} className="accent-emerald-600" />Just now</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="eaten-at" checked={mode === "custom"} onChange={() => setMode("custom")} className="accent-emerald-600" />Choose another date or time</label>
          </fieldset>
          {mode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">Date eaten
                <input type="date" required value={mealDate} onChange={(e) => setMealDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">Time eaten
                <input type="time" required value={mealClock} onChange={(e) => setMealClock(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              </label>
              <p className="col-span-2 text-xs text-slate-500">Uses your device's local timezone.</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" disabled={isSaving} onClick={() => dialogRef.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={isSaving} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Saving..." : "Confirm & Save"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
