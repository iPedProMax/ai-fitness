"use client";

import {
  useState,
} from "react";

import type {
  FoodAnalysis,
} from "@/lib/food-analysis";

type Clarification =
  FoodAnalysis["clarifications"][number];

type ClarificationCardProps = {
  clarification: Clarification;

  selectedAnswer:
    string | null;

  disabled: boolean;

  onSelect: (
    answer: string
  ) => void;
};

export function ClarificationCard({
  clarification,
  selectedAnswer,
  disabled,
  onSelect,
}: ClarificationCardProps) {
  const [
    showCustomInput,
    setShowCustomInput,
  ] = useState(false);

  const [
    customAnswer,
    setCustomAnswer,
  ] = useState("");

  const trimmedCustomAnswer =
    customAnswer.trim();

  function submitCustomAnswer() {
    if (
      disabled ||
      trimmedCustomAnswer.length ===
        0
    ) {
      return;
    }

    onSelect(
      trimmedCustomAnswer
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Clarification needed
      </p>

      <p className="mt-2 font-semibold text-slate-900">
        {
          clarification.question
        }
      </p>

      <p className="mt-1 text-sm text-slate-600">
        A quick answer can
        improve the nutrition
        estimate.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {clarification.options.map(
          (option) => {
            const selected =
              selectedAnswer ===
              option;

            return (
              <button
                key={option}
                type="button"
                disabled={
                  disabled
                }
                onClick={() => {
                  setShowCustomInput(
                    false
                  );

                  onSelect(
                    option
                  );
                }}
                className={
                  selected
                    ? "rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-wait disabled:opacity-60"
                    : "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
                }
              >
                {option}
              </button>
            );
          }
        )}

        {clarification.allowCustomAnswer && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setShowCustomInput(
                true
              )
            }
            className={
              showCustomInput
                ? "rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                : "rounded-xl border border-dashed border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
            }
          >
            Other / type it
          </button>
        )}
      </div>

      {clarification.allowCustomAnswer &&
        showCustomInput && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-white p-3">
            <label className="text-xs font-medium text-slate-600">
              Your answer
            </label>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={
                  customAnswer
                }
                disabled={
                  disabled
                }
                autoFocus
                placeholder="e.g. 2 spoons, 10g, half tbsp"
                onChange={(
                  event
                ) =>
                  setCustomAnswer(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    submitCustomAnswer();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />

              <button
                type="button"
                disabled={
                  disabled ||
                  trimmedCustomAnswer.length ===
                    0
                }
                onClick={
                  submitCustomAnswer
                }
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Update
              </button>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              You can answer
              naturally. Examples:
              2 teaspoons, about
              10g, half a
              tablespoon, 100 ml.
            </p>
          </div>
        )}

      {selectedAnswer && (
        <div className="mt-3 rounded-xl bg-emerald-100 px-3 py-2">
          <p className="text-xs font-medium text-emerald-800">
            Selected:{" "}
            {selectedAnswer}
          </p>
        </div>
      )}
    </div>
  );
}