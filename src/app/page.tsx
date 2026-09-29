"use client";

import { ChangeEvent, useState } from "react";

type FoodItem = {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const demoFoods: FoodItem[] = [
  {
    name: "White rice",
    amount: "180 g",
    calories: 234,
    protein: 4.3,
    carbs: 51,
    fat: 0.5,
  },
  {
    name: "Chicken adobo",
    amount: "150 g",
    calories: 310,
    protein: 28,
    carbs: 7,
    fat: 19,
  },
  {
    name: "Fried egg",
    amount: "55 g",
    calories: 95,
    protein: 6.5,
    carbs: 0.5,
    fat: 7.2,
  },
];

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [analyzed, setAnalyzed] = useState(false);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setAnalyzed(false);

    const reader = new FileReader();

    reader.onload = () => {
      setPreview(reader.result as string);
    };

    reader.readAsDataURL(file);
  }

  const totalCalories = demoFoods.reduce(
    (total, item) => total + item.calories,
    0
  );

  const totalProtein = demoFoods.reduce(
    (total, item) => total + item.protein,
    0
  );

  const totalCarbs = demoFoods.reduce(
    (total, item) => total + item.carbs,
    0
  );

  const totalFat = demoFoods.reduce(
    (total, item) => total + item.fat,
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">
              AI <span className="text-emerald-600">Fitness</span>
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
        {/* Intro */}
        <section className="mb-8">
          <p className="mb-2 text-sm font-medium text-emerald-600">
            MVP • Food Scanner
          </p>

          <h2 className="text-3xl font-bold tracking-tight">
            What did you eat?
          </h2>

          <p className="mt-2 max-w-2xl text-slate-500">
            Upload a photo of your meal. Soon Gemini will identify the food,
            estimate the portion, and calculate calories and macros.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Card */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold">Food photo</h3>
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

                  <p className="font-semibold">Choose a food photo</p>

                  <p className="mt-1 text-sm text-slate-500">
                    JPG, PNG or WEBP
                  </p>
                </div>
              )}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>

            {fileName && (
              <p className="mt-3 truncate text-sm text-slate-500">
                Selected: {fileName}
              </p>
            )}

            <button
              onClick={() => setAnalyzed(true)}
              disabled={!preview}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              ✨ Analyze Food
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              Demo mode for now. Gemini comes next.
            </p>
          </section>

          {/* Results */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">AI Meal Analysis</h3>
                <p className="text-sm text-slate-500">
                  Review before saving.
                </p>
              </div>

              {analyzed && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Demo result
                </span>
              )}
            </div>

            {!analyzed ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
                <div className="mb-4 text-5xl">🍽️</div>

                <p className="font-medium">No analysis yet</p>

                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Upload a meal photo and click Analyze Food.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {demoFoods.map((food) => (
                    <div
                      key={food.name}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{food.name}</p>

                          <p className="text-sm text-slate-500">
                            Estimated amount: {food.amount}
                          </p>
                        </div>

                        <p className="font-bold text-emerald-600">
                          {food.calories} kcal
                        </p>
                      </div>

                      <div className="mt-3 flex gap-4 text-xs text-slate-500">
                        <span>Protein {food.protein}g</span>
                        <span>Carbs {food.carbs}g</span>
                        <span>Fat {food.fat}g</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
                  <p className="text-sm text-slate-400">
                    Estimated meal total
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {totalCalories} kcal
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">Protein</p>
                      <p className="font-semibold">
                        {totalProtein.toFixed(1)}g
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">Carbs</p>
                      <p className="font-semibold">
                        {totalCarbs.toFixed(1)}g
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">Fat</p>
                      <p className="font-semibold">
                        {totalFat.toFixed(1)}g
                      </p>
                    </div>
                  </div>
                </div>

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

        {/* Coming Soon */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">⚖️</div>
            <h3 className="font-semibold">Food Scale</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload a scale photo for measured food weight.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">🏃</div>
            <h3 className="font-semibold">Exercise</h3>
            <p className="mt-1 text-sm text-slate-500">
              Describe workouts or upload smartwatch screenshots.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-2xl">✨</div>
            <h3 className="font-semibold">AI Coach</h3>
            <p className="mt-1 text-sm text-slate-500">
              Ask questions using your own fitness data.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}