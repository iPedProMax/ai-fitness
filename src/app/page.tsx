"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import { ClarificationCard } from "@/components/clarification-card";
import { analyzeFood } from "@/lib/analyze-food";
import { refineFoodAnalysis } from "@/lib/refine-food-analysis";
import type { FoodAnalysis } from "@/lib/food-analysis";

export default function Home() {
  const [preview, setPreview] =
    useState<string | null>(null);

  const [fileName, setFileName] =
    useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [analysis, setAnalysis] =
    useState<FoodAnalysis | null>(null);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    refineError,
    setRefineError,
  ] = useState<string | null>(null);

  const [
    selectedAnswers,
    setSelectedAnswers,
  ] = useState<Record<string, string>>(
    {}
  );

  const [
    refiningClarificationId,
    setRefiningClarificationId,
  ] = useState<string | null>(null);

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);

    setAnalysis(null);
    setError(null);
    setRefineError(null);
    setSelectedAnswers({});
    setRefiningClarificationId(null);

    const reader = new FileReader();

    reader.onload = () => {
      setPreview(
        reader.result as string
      );
    };

    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (
      !selectedFile ||
      isAnalyzing
    ) {
      return;
    }

    try {
      setIsAnalyzing(true);

      setError(null);
      setRefineError(null);
      setAnalysis(null);
      setSelectedAnswers({});

      const result =
        await analyzeFood(selectedFile);

      setAnalysis(result);
    } catch (error) {
      console.error(
        "Food analysis failed:",
        error
      );

      setError(
        "Food analysis failed. Please try again in a moment."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleClarificationSelect(
    clarificationId: string,
    answer: string
  ) {
    if (
      !analysis ||
      refiningClarificationId
    ) {
      return;
    }

    setSelectedAnswers(
      (current) => ({
        ...current,
        [clarificationId]:
          answer,
      })
    );

    setRefiningClarificationId(
      clarificationId
    );

    setRefineError(null);

    try {
      const refined =
        await refineFoodAnalysis(
          analysis,
          clarificationId,
          answer
        );

      setAnalysis(refined);

      setSelectedAnswers((current) => ({
        ...current,

        [clarificationId]:
          clarificationId.startsWith("tare_status_")
            ? answer === "Yes"
              ? "Container tared — scale weight used"
              : answer === "No"
                ? "Container not tared — scale weight ignored"
                : "Tare unknown — scale weight ignored"
            : answer,
      }));

    } catch (error) {
      console.error(
        "Food refinement failed:",
        error
      );

      setSelectedAnswers(
        (current) => {
          const updated = {
            ...current,
          };

          delete updated[
            clarificationId
          ];

          return updated;
        }
      );

      setRefineError(
        "We couldn't update the nutrition estimate. Please try the clarification again."
      );
    } finally {
      setRefiningClarificationId(
        null
      );
    }
  }

  const foods =
    analysis?.foods ?? [];

  const clarifications =
    analysis?.clarifications ?? [];

  const confirmedAnswers =
    Object.values(
      selectedAnswers
    );

  const totalProtein =
    foods.reduce(
      (total, item) =>
        total + item.protein,
      0
    );

  const totalCarbs =
    foods.reduce(
      (total, item) =>
        total + item.carbs,
      0
    );

  const totalFat =
    foods.reduce(
      (total, item) =>
        total + item.fat,
      0
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">
              AI{" "}
              <span className="text-emerald-600">
                Fitness
              </span>
            </h1>

            <p className="text-xs text-slate-500">
              Temporary project name
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
            P
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8">
          <p className="mb-2 text-sm font-medium text-emerald-600">
            MVP • Food Scanner
          </p>

          <h2 className="text-3xl font-bold tracking-tight">
            What did you eat?
          </h2>

          <p className="mt-2 max-w-2xl text-slate-500">
            Upload a photo of your
            meal. Gemini will identify
            visible foods and estimate
            the portion, calories, and
            macros.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold">
                Food photo
              </h3>

              <p className="text-sm text-slate-500">
                Plate photo is required.
              </p>
            </div>

            <label className="flex min-h-[340px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-emerald-500 hover:bg-emerald-50">
              {preview ? (
                <img
                  src={preview}
                  alt="Selected food"
                  className="h-[340px] w-full object-cover"
                />
              ) : (
                <div className="px-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                    📷
                  </div>

                  <p className="font-semibold">
                    Choose a food photo
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    JPG, PNG or WEBP
                  </p>
                </div>
              )}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={
                  handleImageChange
                }
              />
            </label>

            {fileName && (
              <p className="mt-3 truncate text-sm text-slate-500">
                Selected: {fileName}
              </p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={
                !selectedFile ||
                isAnalyzing
              }
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAnalyzing
                ? "✨ Analyzing Food..."
                : "✨ Analyze Food"}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              AI nutrition results are
              estimates and may vary
              depending on ingredients
              and preparation.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  AI Meal Analysis
                </h3>

                <p className="text-sm text-slate-500">
                  Review before saving.
                </p>
              </div>

              {analysis && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  AI result
                </span>
              )}
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {refineError && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {refineError}
              </div>
            )}

            {isAnalyzing ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
                <div className="mb-4 text-5xl">
                  ✨
                </div>

                <p className="font-medium">
                  Gemini is analyzing
                  your meal...
                </p>

                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Identifying foods and
                  estimating calories
                  and macros.
                </p>
              </div>
            ) : !analysis ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
                <div className="mb-4 text-5xl">
                  🍽️
                </div>

                <p className="font-medium">
                  No analysis yet
                </p>

                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Upload a meal photo
                  and click Analyze Food.
                </p>
              </div>
            ) : foods.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
                <div className="mb-4 text-5xl">
                  🤔
                </div>

                <p className="font-medium">
                  No food confidently
                  detected
                </p>

                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {analysis.notes ||
                    "Try uploading a clearer photo of the meal."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {foods.map(
                    (food, index) => (
                      <div
                        key={`${food.name}-${index}`}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">
                              {food.name}
                            </p>

                            <p className="text-sm text-slate-500">
                              {food.weightSource ===
                                "SCALE_MEASURED"
                                ? `Measured amount: ${food.estimatedGrams.toFixed(
                                  1
                                )} g`
                                : `Estimated amount: ~${Math.round(
                                  food.estimatedGrams
                                )} g`}
                            </p>
                          </div>

                          <p className="font-bold text-emerald-600">
                            ~
                            {Math.round(
                              food.calories
                            )}{" "}
                            kcal
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>
                            Protein{" "}
                            {food.protein.toFixed(
                              1
                            )}
                            g
                          </span>

                          <span>
                            Carbs{" "}
                            {food.carbs.toFixed(
                              1
                            )}
                            g
                          </span>

                          <span>
                            Fat{" "}
                            {food.fat.toFixed(
                              1
                            )}
                            g
                          </span>

                          <span>
                            Confidence{" "}
                            {Math.round(
                              food.confidence *
                              100
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
                  <p className="text-sm text-slate-400">
                    Estimated meal total
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    ~
                    {Math.round(
                      analysis.totalCalories
                    )}{" "}
                    kcal
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">
                        Protein
                      </p>

                      <p className="font-semibold">
                        {totalProtein.toFixed(
                          1
                        )}
                        g
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">
                        Carbs
                      </p>

                      <p className="font-semibold">
                        {totalCarbs.toFixed(
                          1
                        )}
                        g
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">
                        Fat
                      </p>

                      <p className="font-semibold">
                        {totalFat.toFixed(
                          1
                        )}
                        g
                      </p>
                    </div>
                  </div>
                </div>

                {clarifications.length >
                  0 && (
                    <div className="mt-5 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Help improve
                          this estimate
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          The AI found
                          something that
                          could significantly
                          change the nutrition
                          result.
                        </p>
                      </div>

                      {clarifications.map(
                        (
                          clarification
                        ) => (
                          <ClarificationCard
                            key={
                              clarification.id
                            }
                            clarification={
                              clarification
                            }
                            selectedAnswer={
                              selectedAnswers[
                              clarification
                                .id
                              ] ?? null
                            }
                            disabled={
                              refiningClarificationId ===
                              clarification.id
                            }
                            onSelect={(
                              answer
                            ) =>
                              handleClarificationSelect(
                                clarification.id,
                                answer
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  )}

                {confirmedAnswers.length >
                  0 &&
                  clarifications.length ===
                  0 && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        User confirmed
                      </p>

                      <p className="mt-1 text-sm font-medium text-emerald-900">
                        {confirmedAnswers.join(
                          ", "
                        )}
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        Nutrition has
                        been updated
                        using your
                        clarification.
                      </p>
                    </div>
                  )}

                {analysis.notes && (
                  <div className="mt-5 rounded-2xl bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      AI notes
                    </p>

                    <p className="mt-1 text-sm text-amber-900">
                      {analysis.notes}
                    </p>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button className="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50">
                    Edit Items
                  </button>

                  <button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">
                    Add Meal
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">
              ⚖️
            </div>

            <h3 className="font-semibold">
              Food Scale
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Upload a scale photo for
              measured food weight.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">
              🏃
            </div>

            <h3 className="font-semibold">
              Exercise
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Describe workouts or
              upload smartwatch
              screenshots.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">
              ✨
            </div>

            <h3 className="font-semibold">
              AI Coach
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Ask questions using your
              own fitness data.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}