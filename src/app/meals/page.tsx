import { browseMealIds, groupMealHistory, parseMealHistoryView, philippinesMealClock } from "@/lib/meal-history-browse";
import { MealHistoryFilters, MealHistoryLoadMore } from "@/components/meal-history-filters";
import Link from "next/link";
import { AdvancedNutrientsSummary } from "@/components/advanced-nutrients-summary";
import { findAdvancedForNamedFood, type AdvancedNutrients } from "@/lib/advanced-nutrients";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { foodEmoji } from "@/lib/food-emoji";
import { EditMealTime } from "@/components/edit-meal-time";
import { MealQuickActions } from "@/components/meal-quick-actions";
import { MealEditor } from "@/components/meal-editor";
import { MealHistoryThumbnail } from "@/components/meal-history-thumbnail";


type MealItem = {
  id: string;
  name: string;
  estimated_grams: number;
  calories: number;
};

type SavedMeal = {
  id: string;
  created_at: string;
  analysis_snapshot?: { entryMethod?: string; foods?: Array<{ name?: string; unknownMacros?: ("protein" | "carbs" | "fat")[]; advancedNutrients?: AdvancedNutrients }> } | null;
  consumed_at: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  notes: string;
  meal_items: MealItem[];
  thumbnail_path?: string | null;
};

function formatNumber(value: number) {
  return Math.round(Number(value));
}

function formatMacro(value: number) {
  return Math.round(Number(value) * 10) / 10;
}


export default async function MealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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

    // Phase Z1: logged-day browsing and server-side food/date searching.
  const view = parseMealHistoryView(await searchParams);
  const browse = await browseMealIds(supabase, user.id, view);
  const idsOrder = new Map(browse.ids.map((id, i) => [id, i]));
  const mealResults: SavedMeal[] = [];
  let detailError = false;
  for (let offset = 0; offset < browse.ids.length; offset += 60) {
    const chunk = browse.ids.slice(offset, offset + 60);
    const { data: batch, error: batchError } = await supabase
      .from("meals")
      .select(`
      id,
      created_at,
      consumed_at,
      analysis_snapshot,
      thumbnail_path,
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
      .eq("user_id", user.id)
      .in("id", chunk);
    if (batchError) { detailError = true; break; }
    mealResults.push(...(batch ?? []) as unknown as SavedMeal[]);
  }
  const error = browse.error || detailError;
  const meals = error ? [] : mealResults.sort((left, right) =>
    (idsOrder.get(left.id) ?? 999999) - (idsOrder.get(right.id) ?? 999999));
  const dayGroups = groupMealHistory(meals);
  // These are PRIVATE Storage objects; only request signed URLs with the signed-in user's session.
  const photoPaths = [...new Set(meals.map(m => m.thumbnail_path).filter((path): path is string => Boolean(path)))].slice(0, 100);
  const photoUrls = new Map<string, string>();
  if (photoPaths.length) {
    const {data: signed} = await supabase.storage.from("meal-thumbnails").createSignedUrls(photoPaths, 1800);
    for (const item of signed ?? []) if (item.path && item.signedUrl) photoUrls.set(item.path, item.signedUrl);
  }

  return (
    <main className="khalories-dark-meals min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav aria-label="Meal History navigation" className="flex w-full flex-wrap items-center justify-between gap-3">
          <Link
          href="/"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          &larr; Back to scanner
        </Link>
          <a href="/?mode=saved" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#176141] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#104d32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176141]">My recipes &amp; favorites →</a>
        </nav>
        <header className="mt-8">
          <h1 className="text-3xl font-bold">Meal History</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your saved meals, nutrition estimates, and dates.
          </p>
        </header>
        <MealHistoryFilters view={view} />

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
              No meals found for these filters
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
          <section className="mt-7 space-y-5" aria-label="Saved meals by date">
            {dayGroups.map((group) => (
              <section key={group.day} aria-label={group.label} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                  <h2 className="text-base font-extrabold text-[#153c2c]">{group.label}</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {group.meals.length} meal{group.meals.length === 1 ? "" : "s"} logged · {Math.round(group.calories).toLocaleString()} recorded kcal
                  </p>
                </div>
                <div className="space-y-3">
                  {group.meals.map((meal) => (
                    <details key={meal.id} className="group overflow-hidden rounded-2xl border border-[#dce7d8] bg-white shadow-sm">
                      <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-4 transition hover:bg-[#f5faf2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                        <MealHistoryThumbnail
                          src={meal.thumbnail_path ? photoUrls.get(meal.thumbnail_path) : undefined}
                          foodName={meal.meal_items?.[0]?.name ?? "Saved meal"}
                          emoji={foodEmoji(meal.meal_items?.[0]?.name ?? "Meal")}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#153c2c]">{meal.meal_items?.map(item => item.name).join(", ") || "Saved meal"}</span>
                          <span className="mt-1 block text-xs text-slate-500">{philippinesMealClock(meal.consumed_at ?? meal.created_at)} · Tap to view nutrition</span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-extrabold text-[#176141]">{Math.round(Number(meal.total_calories))} kcal</span>
                        <span className="ml-1 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                      </summary>
                      <article
                key={meal.id}
                className="border-t border-slate-100 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
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
                            <AdvancedNutrientsSummary values={findAdvancedForNamedFood(meal.analysis_snapshot?.foods, item.name)} />
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
                    </details>
                  ))}
                </div>
              </section>
            ))}
            <MealHistoryLoadMore view={view} hasMore={browse.hasMore} truncated={browse.truncated} />
          </section>
        )}
      </div>
    </main>
  );
}
