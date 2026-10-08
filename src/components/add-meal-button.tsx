"use client";

import {
  useRef,
  useState,
} from "react";

import type {
  FoodAnalysis,
} from "@/lib/food-analysis";

import {
  saveMeal,
} from "@/app/meals/actions";

type AddMealButtonProps = {
  analysis: FoodAnalysis;
};

export function AddMealButton({
  analysis,
}: AddMealButtonProps) {
  const savingRef = useRef(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    savedAnalysis,
    setSavedAnalysis,
  ] = useState<FoodAnalysis | null>(null);

  const [
    error,
    setError,
  ] = useState<{
    analysis: FoodAnalysis;
    message: string;
  } | null>(null);

  const isSaved =
    savedAnalysis === analysis;

  async function handleSave() {
    if (
      savingRef.current ||
      isSaved
    ) {
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const result =
        await saveMeal(analysis);

      if (result.ok) {
        setSavedAnalysis(analysis);
        return;
      }

      if (
        result.code ===
        "UNAUTHENTICATED"
      ) {
        window.location.assign(
          "/auth/login?message=" +
            encodeURIComponent(
              "Sign in to save your meal."
            )
        );

        return;
      }

      setError({
        analysis,
        message: result.message,
      });
    } catch {
      setError({
        analysis,
        message:
          "Something went wrong while saving your meal. Please try again.",
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isSaved}
        aria-busy={isSaving}
        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving
          ? "Saving..."
          : isSaved
            ? "Saved!"
            : "Add Meal"}
      </button>

      {isSaved && (
        <p
          role="status"
          className="text-xs text-emerald-700"
        >
          Meal saved successfully.
        </p>
      )}

      {error?.analysis === analysis && (
        <p
          role="alert"
          className="max-w-xs text-xs text-red-600"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
