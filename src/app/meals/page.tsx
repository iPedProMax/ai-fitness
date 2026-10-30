import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { foodEmoji } from "@/lib/food-emoji";
import { EditMealTime } from "@/components/edit-meal-time";
import { MealQuickActions } from "@/components/meal-quick-actions";
import { MealEditor } from "@/components/meal-editor";

type MealItem = {
  id: string;
  name: string;
  estimated_grams: number;
  calories: number;
};

type SavedMeal = {
  id: string;
  created_at: string;
  analysis_snapshot?: { entryMethod?: string; foods?: Array<{ unknownMacros?: ("protein" | "carbs" | "fat")[] }> } | null;
  consumed_at: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  notes: string;
  meal_items: MealItem[];
};

function formatNumber(value: number) {
  return Math.round(Number(value));
}

function formatMacro(value: number) {
  return Math.round(Number(value) * 10) / 10;
}


export default async function MealsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent("Sign in to view your meal history.")
    );
  }

  const { data, error } = await supabase
    .from("meals")
    .select(`
      id,
      created_at,
      consumed_at,
      analysis_snapshot,
      total_calories,
      total_protein,
      total_carbs,
      total_fat,
      notes,
      meal_items (
        id,
        name,
        estimated_grams,
        calories
      )
    `)
    .order("consumed_at", { ascending: false });

  // Supabase RLS restricts results to the signed-in owner.
  const meals = (data ?? []) as unknown as SavedMeal[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          &larr; Back to scanner
        </Link>

        <a href="/recipes" className="mt-4 inline-block rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">My recipes &amp; favorites →</a>
        <header className="mt-8">
          <h1 className="text-3xl font-bold">Meal History</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your saved meals, nutrition estimates, and dates.
          </p>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-white p-6 text-red-700"
          >
            Could not load your meals. Please try again.
          </div>
        ) : meals.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">
              No meals saved yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Analyze some food and select Add Meal to save it here.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Scan food
            </Link>
          </section>
        ) : (
          <section className="mt-8 space-y-5">
            {meals.map((meal) => (
              <article
                key={meal.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <EditMealTime
                      mealId={meal.id}
                      consumedAt={meal.consumed_at ?? meal.created_at}
                      createdAt={meal.created_at}
                    />
                    <h2 className="mt-2 text-2xl font-bold text-emerald-700">
                      {formatNumber(meal.total_calories)} kcal
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Saved meal
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["Protein", meal.total_protein],
                    ["Carbs", meal.total_carbs],
                    ["Fat", meal.total_fat],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-slate-50 p-3"
                    >
                      <p className="text-xs text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 font-semibold">
                        {meal.analysis_snapshot?.foods?.some((food) =>
                          food.unknownMacros?.includes(String(label).toLowerCase() as "protein" | "carbs" | "fat")
                        ) ? "Unknown" : `${formatMacro(Number(value))} g`}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold">
                    Food items
                  </h3>

                  {meal.meal_items?.length ? (
                    <ul className="mt-3 space-y-3">
                      {meal.meal_items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {(meal.analysis_snapshot?.entryMethod === "MANUAL" || meal.analysis_snapshot?.entryMethod === "TEXT_AI") && (
                                <span aria-hidden="true" className="mr-2">{foodEmoji(item.name)}</span>
                              )}
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(meal.analysis_snapshot?.entryMethod === "MANUAL" || meal.analysis_snapshot?.entryMethod === "TEXT_AI") && item.estimated_grams === 0
                                ? "Weight not provided"
                                : `Approx. ${formatNumber(item.estimated_grams)} g`}
                            </p>
                          </div>
                          <span className="font-semibold">
                            {formatNumber(item.calories)} kcal
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No individual food items recorded.
                    </p>
                  )}
                </div>

                {meal.notes && (
                  <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    {meal.notes}
                  </p>
                )}
                <MealEditor id={meal.id} snapshot={meal.analysis_snapshot} />
                <MealQuickActions mealId={meal.id} />
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
