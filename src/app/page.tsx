"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { AddMealButton } from "@/components/add-meal-button";
import { LogFoodPanel } from "@/components/log-food-panel";

import { AiHttpError } from "@/lib/ai-submission";

import { foodEmoji } from "@/lib/food-emoji";
import { ClarificationCard } from "@/components/clarification-card";
import {
  isUnknownVarietyAnswer,
  skipVarietyClarification,
} from "@/lib/variety-clarification";
import {
  isUnknownBrandAnswer,
  skipBrandClarification,
} from "@/lib/brand-clarification";
import { analyzeFood } from "@/lib/analyze-food";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { refineFoodAnalysis } from "@/lib/refine-food-analysis";

const MAX_IMAGES = 10;

type ImageThumbnailProps = {
  file: File;
  index: number;
  onRemove: () => void;
};

function ImageThumbnail({
  file,
  index,
  onRemove,
}: ImageThumbnailProps) {
  const [
    preview,
    setPreview,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    const objectUrl =
      URL.createObjectURL(file);

    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [file]);

  return (
    <div className="relative w-24 shrink-0 sm:w-28">
      <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {preview && (
          <img
            src={preview}
            alt={`Meal image ${index + 1}`}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove image ${index + 1}`}
        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-100"
      >
        ×
      </button>
    </div>
  );
}

export default function Home() {
  const [entryMode, setEntryMode] = useState<"photo" | "manual">("photo");
  const [
    images,
    setImages,
  ] = useState<File[]>([]);

  const [
    analysis,
    setAnalysis,
  ] = useState<
    FoodAnalysis | null
  >(null);

  const [
    analysisStarted,
    setAnalysisStarted,
  ] = useState(false);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    refineError,
    setRefineError,
  ] = useState<
    string | null
  >(null);

  const [
    imageNotice,
    setImageNotice,
  ] = useState<
    string | null
  >(null);

  const [
    selectedAnswers,
    setSelectedAnswers,
  ] = useState<
    Record<string, string>
  >({});

  const [
    refiningClarificationId,
    setRefiningClarificationId,
  ] = useState<
    string | null
  >(null);

  const resultRef =
    useRef<HTMLElement | null>(
      null
    );

  const uploaderRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const hasImages =
    images.length > 0;

  useEffect(() => {
    if (
      !analysisStarted ||
      !resultRef.current
    ) {
      return;
    }

    if (
      window.innerWidth < 1024
    ) {
      const timeout =
        window.setTimeout(() => {
          resultRef.current?.scrollIntoView(
            {
              behavior: "smooth",
              block: "start",
            }
          );
        }, 120);

      return () => {
        window.clearTimeout(
          timeout
        );
      };
    }
  }, [analysisStarted]);

  function resetAnalysis() {
    setAnalysis(null);
    setAnalysisStarted(false);
    setError(null);
    setRefineError(null);
    setSelectedAnswers({});
    setRefiningClarificationId(
      null
    );
  }

  function fileKey(
    file: File
  ) {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  function addImages(
    incoming: File[]
  ) {
    const supported =
      incoming.filter(
        (file) =>
          [
            "image/jpeg",
            "image/png",
            "image/webp",
          ].includes(
            file.type
          )
      );

    const existingKeys =
      new Set(
        images.map(fileKey)
      );

    const unique =
      supported.filter(
        (file) =>
          !existingKeys.has(
            fileKey(file)
          )
      );

    const remaining =
      MAX_IMAGES -
      images.length;

    const accepted =
      unique.slice(
        0,
        remaining
      );

    if (
      unique.length >
      remaining
    ) {
      setImageNotice(
        "You can attach up to 10 images per analysis."
      );
    } else {
      setImageNotice(null);
    }

    if (
      accepted.length === 0
    ) {
      return;
    }

    setImages([
      ...images,
      ...accepted,
    ]);

    resetAnalysis();
  }

  function removeImage(
    index: number
  ) {
    setImages(
      images.filter(
        (_, imageIndex) =>
          imageIndex !==
          index
      )
    );

    setImageNotice(null);

    resetAnalysis();
  }

  async function handleAnalyze() {
    if (
      !hasImages ||
      isAnalyzing
    ) {
      return;
    }

    setAnalysisStarted(true);

    try {
      setIsAnalyzing(true);

      setError(null);
      setRefineError(null);
      setAnalysis(null);
      setSelectedAnswers({});

      const result =
        await analyzeFood({
          images,
        });

      setAnalysis(result);
    } catch (error) {
      // Expected API errors are already shown inline. Avoid the Next.js dev overlay.
      if (!(error instanceof AiHttpError)) {
        console.error("Unexpected food analysis error:", error);
      }

      setError(
        error instanceof Error
          ? error.message
          : "Food analysis failed. Please try again."
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

    if (
      isUnknownVarietyAnswer(
        clarificationId,
        answer
      )
    ) {
      setSelectedAnswers((current) => ({
        ...current,
        [clarificationId]:
          "Variety unknown - original estimate kept",
      }));

      setAnalysis((current) =>
        current
          ? skipVarietyClarification(
              current,
              clarificationId
            )
          : current
      );

      return;
    }

    if (
      isUnknownBrandAnswer(
        clarificationId,
        answer
      )
    ) {
      setSelectedAnswers((current) => ({
        ...current,
        [clarificationId]:
          "Brand unknown - original estimate kept",
      }));

      setAnalysis((current) =>
        current
          ? skipBrandClarification(current, clarificationId)
          : current
      );

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
          answer,

        );

      setAnalysis(refined);

      setSelectedAnswers(
        (current) => ({
          ...current,

          [clarificationId]:
            clarificationId.startsWith(
              "tare_status_"
            )
              ? answer ===
                "Yes"
                ? "Container tared — scale weight used"
                : answer ===
                    "No"
                  ? "Container not tared — scale weight ignored"
                  : "Tare unknown — scale weight ignored"
              : answer,
        })
      );
    } catch (error) {
      // Expected API errors are already shown inline. Avoid the Next.js dev overlay.
      if (!(error instanceof AiHttpError)) {
        console.error("Unexpected food refinement error:", error);
      }

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
        "We couldn't update the estimate. Please try again."
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
    analysis
      ?.clarifications ??
    [];

  const confirmedAnswers =
    Object.values(
      selectedAnswers
    );

  const totalProtein =
    foods.reduce(
      (total, food) =>
        total +
        food.protein,
      0
    );

  const totalCarbs =
    foods.reduce(
      (total, food) =>
        total +
        food.carbs,
      0
    );

  const totalFat =
    foods.reduce(
      (total, food) =>
        total + food.fat,
      0
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium text-emerald-600">
            Log Food
          </p>

          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What did you eat?
          </h2>

          <p className="mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
            For best results, scan 1-3 foods or drinks at a time. Add up to 10 photos, including labels, packaging, and scale photos.
          </p>
        </section>

        <div className="mb-6 flex max-w-xl gap-2 rounded-2xl bg-slate-100 p-1" role="group" aria-label="How to log food">
          <button type="button" aria-pressed={entryMode === "photo"} onClick={() => { setEntryMode("photo"); resetAnalysis(); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${entryMode === "photo" ? "bg-white text-emerald-700 shadow" : "text-slate-600"}`}>📷 Photo Scanner</button>
          <button type="button" aria-pressed={entryMode === "manual"} onClick={() => { setEntryMode("manual"); resetAnalysis(); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${entryMode === "manual" ? "bg-white text-emerald-700 shadow" : "text-slate-600"}`}>✏️ Manual / Text</button>
        </div>

        <div
          ref={uploaderRef}
          className={
            analysisStarted
              ? "grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
              : "mx-auto max-w-2xl"
          }
        >
          {entryMode === "photo" ? (
          <section
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-500 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold sm:text-lg">
                  Add photos
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                  No need to
                  classify anything.
                  The AI will inspect
                  them together.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>

            {images.length >
              0 ? (
              <div className="mt-5 flex gap-3 overflow-x-auto pb-2 pt-2">
                {images.map(
                  (
                    file,
                    index
                  ) => (
                    <ImageThumbnail
                      key={fileKey(
                        file
                      )}
                      file={file}
                      index={
                        index
                      }
                      onRemove={() =>
                        removeImage(
                          index
                        )
                      }
                    />
                  )
                )}

                {images.length <
                  MAX_IMAGES && (
                  <label className="flex aspect-square w-24 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition hover:border-emerald-300 hover:bg-emerald-50 sm:w-28">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(
                        event
                      ) => {
                        addImages(
                          Array.from(
                            event
                              .target
                              .files ??
                              []
                          )
                        );

                        event.currentTarget.value =
                          "";
                      }}
                    />

                    <span className="text-xs font-medium text-slate-500">
                      ＋ Add
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div>
                  <div className="text-3xl">
                    📸
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Add at least
                    one photo
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Up to ten images.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  disabled={
                    images.length >=
                    MAX_IMAGES
                  }
                  onChange={(
                    event
                  ) => {
                    addImages(
                      Array.from(
                        event
                          .target
                          .files ??
                          []
                      )
                    );

                    event.currentTarget.value =
                      "";
                  }}
                />

                ＋ Upload
              </label>

              <label className="inline-flex cursor-pointer items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={
                    images.length >=
                    MAX_IMAGES
                  }
                  onChange={(
                    event
                  ) => {
                    const file =
                      event
                        .target
                        .files?.[0];

                    if (file) {
                      addImages([
                        file,
                      ]);
                    }

                    event.currentTarget.value =
                      "";
                  }}
                />

                📷 Camera
              </label>
            </div>

            {imageNotice && (
              <p className="mt-3 text-xs font-medium text-amber-600">
                {imageNotice}
              </p>
            )}

            <button
              type="button"
              onClick={
                handleAnalyze
              }
              disabled={
                !hasImages ||
                isAnalyzing
              }
              className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAnalyzing
                ? "✨ Analyzing..."
                : "✨ Analyze Food"}
            </button>
          </section>

          ) : (
            <LogFoodPanel
              onReset={resetAnalysis} onResult={(result) => {
              setAnalysis(result);
              setAnalysisStarted(true);
              setError(null);
              setRefineError(null);
              setSelectedAnswers({});
            }} />
          )}

          {analysisStarted && (
            <section
              ref={resultRef}
              className="ai-result-enter scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold sm:text-lg">
                    Meal
                    Analysis
                  </h3>

                  <p className="text-xs text-slate-500 sm:text-sm">
                    Review before
                    saving.
                  </p>
                </div>

                {analysis && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {analysis.entryMethod === "MANUAL" ? "User-entered" : "AI result"}
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
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-slate-50 px-6 text-center">
                  <div className="text-4xl">
                    ✨
                  </div>

                  <p className="mt-3 font-medium">
                    Analyzing your
                    food...
                  </p>

                  <p className="mt-1 max-w-xs text-sm text-slate-500">
                    Identifying
                    foods and
                    matching useful
                    evidence.
                  </p>
                </div>
              ) : !analysis ? (
                <div className="flex min-h-52 items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Analysis
                    couldn&apos;t
                    be completed.
                    Edit your entry
                    and try again.
                  </p>
                </div>
              ) : foods.length ===
                0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
                  <div className="text-4xl">
                    🤔
                  </div>

                  <p className="mt-3 font-medium">
                    Not enough
                    information
                  </p>

                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    {analysis.notes ||
                      "Try adding another photo."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {foods.map(
                      (
                        food,
                        index
                      ) => (
                        <div
                          key={`${food.name}-${index}`}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold">
                                {(analysis.entryMethod === "MANUAL" || analysis.entryMethod === "TEXT_AI") && <span aria-hidden="true" className="mr-2">{foodEmoji(food.name)}</span>}
                                {food.name}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {food.weightSource ===
                                "SCALE_MEASURED"
                                  ? `Measured: ${food.estimatedGrams.toFixed(
                                      1
                                    )} g`
: (analysis.entryMethod === "MANUAL" || analysis.entryMethod === "TEXT_AI") && food.estimatedGrams === 0
                                  ? "Weight not provided"
                                  : analysis.entryMethod === "MANUAL"
                                    ? `Entered: ${food.estimatedGrams} g`
                                    : `Estimated: ~${Math.round(food.estimatedGrams)} g`}
                              </p>
                            </div>

                            <p className="shrink-0 font-bold text-emerald-600">
                              {analysis.entryMethod === "MANUAL" ? "" : "~"}
                              {Math.round(
                                food.calories
                              )}{" "}
                              kcal
                            </p>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                            <span>
                              Protein{" "}
                              {food.unknownMacros?.includes("protein") ? "Unknown" : `${food.protein.toFixed(1)}g`}
                            </span>

                            <span>
                              Carbs{" "}
                              {food.unknownMacros?.includes("carbs") ? "Unknown" : `${food.carbs.toFixed(1)}g`}
                            </span>

                            <span>
                              Fat{" "}
                              {food.unknownMacros?.includes("fat") ? "Unknown" : `${food.fat.toFixed(1)}g`}
                            </span>

                            {analysis.entryMethod !== "MANUAL" && analysis.entryMethod !== "TEXT_AI" && <span>
                              Confidence{" "}
                              {Math.round(
                                food.confidence *
                                  100
                              )}
                              %
                            </span>}

                            {analysis.entryMethod === "MANUAL" && <span>Nutrition: User-entered</span>}
                            {analysis.entryMethod === "TEXT_AI" && <span>Nutrition: AI-assisted, reviewed by user</span>}
                            {food.nutritionSource && (
                              <span>
                                Nutrition:{" "}
                                {food.nutritionSource ===
                                "NUTRITION_LABEL"
                                  ? "Label"
                                  : "AI"}
                              </span>
                            )}

                            {food.weightSource && (
                              <span>
                                Weight:{" "}
                                {food.weightSource ===
                                "SCALE_MEASURED"
                                  ? "Scale"
                                  : "AI"}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-900 p-5 text-white">
                    <p className="text-xs text-slate-400">
                      Meal total
                    </p>

                    <p className="mt-1 text-3xl font-bold">
                      {analysis.entryMethod === "MANUAL" ? "" : "~"}
                      {Math.round(
                        analysis.totalCalories
                      )}{" "}
                      kcal
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">
                          Protein
                        </p>

                        <p className="font-semibold">
                          {foods.some((food) => food.unknownMacros?.includes("protein"))
                            ? "Unknown"
                            : `${totalProtein.toFixed(1)}g`}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Carbs
                        </p>

                        <p className="font-semibold">
                          {foods.some((food) => food.unknownMacros?.includes("carbs"))
                            ? "Unknown"
                            : `${totalCarbs.toFixed(1)}g`}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Fat
                        </p>

                        <p className="font-semibold">
                          {foods.some((food) => food.unknownMacros?.includes("fat"))
                            ? "Unknown"
                            : `${totalFat.toFixed(1)}g`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {clarifications.length >
                    0 && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Quick
                          question
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          A little
                          more
                          information
                          could improve
                          the result.
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
                              ] ??
                              null
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
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          User
                          confirmed
                        </p>

                        <p className="mt-1 text-sm font-medium text-emerald-900">
                          {confirmedAnswers.join(
                            ", "
                          )}
                        </p>
                      </div>
                    )}

                  {analysis.notes && (
                    <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {analysis.entryMethod === "MANUAL" ? "Entry notes" : "AI notes"}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-900">
                        {
                          analysis.notes
                        }
                      </p>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        uploaderRef.current?.scrollIntoView(
                          {
                            behavior:
                              "smooth",
                            block:
                              "start",
                          }
                        )
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
                    >
                      {entryMode === "photo" ? "Edit photos" : "Edit entry"}
                    </button>

                    {analysis && <AddMealButton analysis={analysis} />}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes resultSlideMobile {
          from {
            opacity: 0;
            transform: translateY(
              24px
            );
          }

          to {
            opacity: 1;
            transform: translateY(
              0
            );
          }
        }

        @keyframes resultSlideDesktop {
          from {
            opacity: 0;
            transform: translateX(
              28px
            );
          }

          to {
            opacity: 1;
            transform: translateX(
              0
            );
          }
        }

        .ai-result-enter {
          animation: resultSlideMobile
            420ms
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            both;
        }

        @media (
          min-width: 1024px
        ) {
          .ai-result-enter {
            animation-name: resultSlideDesktop;
          }
        }
      `}</style>
    </main>
  );
}
