import { manilaDayKey } from "@/lib/activity";
import { ADVANCED_NUTRIENT_FIELDS, unitForNutrient, type AdvancedNutrientKey } from "@/lib/advanced-nutrients";
const ALL_SAVED_NUTRIENT_KEYS: readonly AdvancedNutrientKey[] = [...ADVANCED_NUTRIENT_FIELDS.map(f => f.key), "addedSugarG", "saturatedFatG"];

export type AdvancedRecordedMeal = {
  consumed_at: string;
  analysis_snapshot?: unknown;
};

export type RecordedNutrient = {
  total: number;
  known: number;
  missing: number;
};

export type AdvancedReportDay = {
  date: string;
  mealCount: number;
  nutrients: Record<AdvancedNutrientKey, RecordedNutrient>;
};

function emptyNutrient(): RecordedNutrient {
  return { total: 0, known: 0, missing: 0 };
}

function initialDay(date: string): AdvancedReportDay {
  return {
    date,
    mealCount: 0,
    nutrients: Object.fromEntries(ALL_SAVED_NUTRIENT_KEYS.map(key => [key, emptyNutrient()])) as Record<AdvancedNutrientKey, RecordedNutrient>,
  };
}

/**
 * Accumulate only manually recorded advanced nutrients from persisted food snapshots.
 * A missing value is not zero. When one food lacks a nutrient, the subtotal is
 * a lower bound from recorded entries, NOT a whole-day nutrition total.
 * Legacy meals without a snapshot contribute one unknown record per nutrient.
 */
export function buildAdvancedNutritionReport(
  meals: readonly AdvancedRecordedMeal[],
  dates: readonly string[],
): AdvancedReportDay[] {
  const results = dates.map(initialDay);
  const byDate = new Map(results.map(day => [day.date, day]));

  for (const meal of meals) {
    const timestamp = new Date(meal.consumed_at);
    if (!Number.isFinite(timestamp.getTime())) continue;
    const day = byDate.get(manilaDayKey(timestamp));
    if (!day) continue;
    day.mealCount++;
    const snapshot = meal.analysis_snapshot;
    const foods = snapshot && typeof snapshot === "object" && "foods" in snapshot ? snapshot.foods : null;
    // Old or malformed snapshots cannot justify treating anything as zero.
    const entries: readonly unknown[] = Array.isArray(foods) && foods.length ? foods : [null];
    for (const food of entries) {
      const rawValues = food && typeof food === "object" && "advancedNutrients" in food
        ? food.advancedNutrients : null;
      // Narrow unknown JSON before indexing. A plain object is required;
      // older or malformed snapshots must remain unknown, never count as 0.
      const values: Record<string, unknown> | null =
        rawValues && typeof rawValues === "object" && !Array.isArray(rawValues)
          ? rawValues as Record<string, unknown>
          : null;
      for (const key of ALL_SAVED_NUTRIENT_KEYS) {
        const nutrient = day.nutrients[key];
        const value = values?.[key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          nutrient.total += value;
          nutrient.known++;
        } else {
          nutrient.missing++;
        }
      }
    }
  }
  return results;
}

export function sumRecordedNutrient(days: readonly AdvancedReportDay[], key: AdvancedNutrientKey): RecordedNutrient {
  return days.reduce((sum, day) => ({
    total: sum.total + day.nutrients[key].total,
    known: sum.known + day.nutrients[key].known,
    missing: sum.missing + day.nutrients[key].missing,
  }), emptyNutrient());
}

/** "Unknown" is distinct from a confirmed 0; partial totals are explicitly labeled. */
export function formatRecordedNutrient(value: RecordedNutrient, key: AdvancedNutrientKey): string {
  if (!value.known) return "Unknown";
  const unit = unitForNutrient(key);
  const rounded = Number(value.total.toFixed(1)).toLocaleString("en-PH", { maximumFractionDigits: 1 });
  return `${rounded} ${unit}${value.missing ? "+" : ""}`;
}

export function completenessLabel(value: RecordedNutrient): string {
  if (!value.known) return "Not recorded";
  if (value.missing) return `${value.known} of ${value.known + value.missing} foods recorded`; 
  return "All logged foods recorded";
}