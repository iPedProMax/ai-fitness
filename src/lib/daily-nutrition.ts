/**
 * Compute a user's daily nutrition summary without inventing missing macros.
 * The database retains numeric placeholders for unknown manual macros,
 * while analysis_snapshot.foods[].unknownMacros records which were not entered.
 */
export type Macro = "protein" | "carbs" | "fat";

export type DailyMealRecord = {
  id: string;
  total_calories: number | string | null;
  total_protein: number | string | null;
  total_carbs: number | string | null;
  total_fat: number | string | null;
  analysis_snapshot?: {
    foods?: Array<{
      unknownMacros?: Macro[];
    }>;
  } | null;
};

export type MacroSummary = {
  grams: number;
  incomplete: boolean;
  anyKnown: boolean;
};

export type DailyNutritionSummary = {
  mealCount: number;
  calories: number;
  protein: MacroSummary;
  carbs: MacroSummary;
  fat: MacroSummary;
};

function numeric(value: number | string | null): number {
  const number = Number(value);
  return value !== null && Number.isFinite(number)
    ? Math.max(0, number)
    : 0;
}

/**
 * Browser-local midnight boundaries as UTC ISO strings for Supabase.
 * Construct the *next local midnight*, not a 24-hour offset: this also
 * works on days when daylight saving time changes.
 */
export function localDayWindow(now: Date = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  return {
    start: new Date(year, month, day).toISOString(),
    end: new Date(year, month, day + 1).toISOString(),
    label: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(now),
  };
}

function summarizeMacro(meals: DailyMealRecord[], macro: Macro): MacroSummary {
  let grams = 0;
  let incomplete = false;
  let anyKnown = false;

  for (const meal of meals) {
    // Legacy meals have no missing-field flags and count as fully recorded.
    const foods = meal.analysis_snapshot?.foods;
    if (Array.isArray(foods) && foods.length > 0) {
      for (const food of foods) {
        if (food.unknownMacros?.includes(macro)) {
          incomplete = true;
        } else {
          anyKnown = true;
        }
      }
    } else {
      anyKnown = true;
    }

    const field = `total_${macro}` as const;
    grams += numeric(meal[field]);
  }

  return { grams, incomplete, anyKnown };
}

export function summarizeDailyNutrition(meals: DailyMealRecord[]): DailyNutritionSummary {
  return {
    mealCount: meals.length,
    calories: meals.reduce((sum, meal) => sum + numeric(meal.total_calories), 0),
    protein: summarizeMacro(meals, "protein"),
    carbs: summarizeMacro(meals, "carbs"),
    fat: summarizeMacro(meals, "fat"),
  };
}

function readableGrams(grams: number): string {
  return Number(grams.toFixed(1)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

export function displayMacro(summary: MacroSummary, mealCount: number): string {
  if (mealCount === 0) return "0 g";
  if (!summary.anyKnown && summary.incomplete) return "Unknown";
  return summary.incomplete
    ? `${readableGrams(summary.grams)} g+`
    : `${readableGrams(summary.grams)} g`;
}
