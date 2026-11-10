import type { Macro } from "./daily-nutrition";
import { findAdvancedForNamedFood, type AdvancedNutrients } from "./advanced-nutrients";
import type { DatedMeal } from "./weekly-report";

export type SavedReportFood = {
  advancedNutrients?: AdvancedNutrients;
  name?: string;
  estimatedGrams?: number | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
  unknownMacros?: Macro[];
};
export type ReportMealItem = {
  id?: string;
  name?: string;
  estimated_grams?: number | string | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
};
export type ReportMeal = Omit<DatedMeal, "analysis_snapshot"> & {
  notes?: string | null;
  meal_items?: ReportMealItem[] | null;
  analysis_snapshot?: {
    entryMethod?: string;
    foods?: SavedReportFood[];
  } | null;
};
export type ReportFoodRow = {
  key: string;
  name: string;
  grams: number | string | null | undefined;
  calories: number | string | null | undefined;
  protein: number | string | null | undefined;
  carbs: number | string | null | undefined;
  fat: number | string | null | undefined;
  unknownMacros: Macro[];
  source: "saved_items" | "snapshot";
};

/** Only trust missing-macro flags when the recorded food name matches the row. */
function missingFor(meal: ReportMeal, row: ReportMealItem): Macro[] {
  const names = meal.analysis_snapshot?.foods?.filter(food =>
    food.name?.trim().toLocaleLowerCase() === row.name?.trim().toLocaleLowerCase()
  ) ?? [];
  if (!names.length) return [];
  if (names.length === 1) return names[0].unknownMacros ?? [];
  // Duplicate names may not preserve row order; favor "Unknown" over a false zero.
  return [...new Set(names.flatMap(food => food.unknownMacros ?? []))];
}

/** Saved item rows are authoritative after meal edits; snapshot is a legacy fallback. */
export function reportFoodRows(meal: ReportMeal): ReportFoodRow[] {
  const items = meal.meal_items;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((item, index) => ({
      key: item.id ?? `saved-${index}`,
      name: item.name?.trim() || "Unnamed food",
      grams: item.estimated_grams,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      unknownMacros: missingFor(meal, item),
      source: "saved_items" as const,
    }));
  }
  return (meal.analysis_snapshot?.foods ?? []).map((food, index) => ({
    key: `snapshot-${index}`,
    name: food.name?.trim() || "Unnamed food",
    grams: food.estimatedGrams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    unknownMacros: food.unknownMacros ?? [],
    source: "snapshot" as const,
  }));
}

export function reportMealTitle(rows: readonly ReportFoodRow[]): string {
  if (!rows.length) return "Saved meal - food details unavailable";
  const names = rows.slice(0, 2).map(item => item.name);
  return names.join(" + ") + (rows.length > 2 ? ` + ${rows.length - 2} more` : "");
}

/** A missing nutrient is not a zero; zero is shown only when actually recorded. */
export function reportNutrient(value: number | string | null | undefined, missing = false, unit: "g" | "kcal" = "g"): string {
  if (missing) return "Unknown";
  if (value === null || value === undefined || value === "") return "Not provided";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return "Not provided";
  return `${Number(numeric.toFixed(1)).toLocaleString("en-PH", { maximumFractionDigits: 1 })} ${unit}`;
}

export function reportFoodWeight(row: ReportFoodRow): string | null {
  if (row.grams === null || row.grams === undefined || row.grams === "") return null;
  const weight = Number(row.grams);
  if (!Number.isFinite(weight) || weight < 0) return null;
  if (weight === 0) return null; // 0g is typically a manual "not provided" placeholder.
  return `Approx. ${Number(weight.toFixed(1)).toLocaleString("en-PH")} g`;
}
/** Values come from the optional saved snapshot, not non-existent meal_items columns. */
export function reportFoodAdvanced(meal: ReportMeal, row: ReportFoodRow): AdvancedNutrients | undefined {
  const foods = meal.analysis_snapshot?.foods;
  if (row.source === "snapshot") {
    const index = Number(row.key.replace(/^snapshot-/, ""));
    return Number.isInteger(index) && index >= 0 ? foods?.[index]?.advancedNutrients : undefined;
  }
  return findAdvancedForNamedFood(foods, row.name);
}
