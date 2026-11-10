/**
 * Read-only food-pattern prompts for the dashboard. These are NOT diagnoses,
 * measurements of uric acid, or individual medical advice.
 *
 * FDA Nutrition Facts guidance: >=20% Daily Value in a serving is "high".
 * Reference DVs (adults/children >=4; not personalized):
 * added sugars 50 g; sodium 2,300 mg.
 */
export type DashboardFoodRecord = {
  id?: string;
  consumed_at: string | null;
  analysis_snapshot?: unknown;
};

export type RecordedAmount = { total: number; known: number; missing: number };
export type FoodInsight = {
  id: string;
  title: string;
  description: string;
  category: "label" | "purine" | "context";
};

export type DashboardFoodInsightSummary = {
  todayMeals: number;
  foodCount: number;
  unknownFoodRows: number;
  sodium: RecordedAmount;
  addedSugar: RecordedAmount;
  totalSugar: RecordedAmount;
  notices: FoodInsight[];
};

const DV_SODIUM_MG = 2300;
const DV_ADDED_SUGAR_G = 50;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function numeric(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
}
function fmt(value: number): string {
  return Number(value.toFixed(1)).toLocaleString("en-PH", { maximumFractionDigits: 1 });
}

/** PH date string, regardless of server clock timezone. */
export function phFoodDayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Intentionally narrow name-based lookup, not a numeric purine database. */
export function isPotentiallyPurineRichFood(name: string): boolean {
  // Restrict to distinct food names. This is a general food-category reminder.
  return /\b(?:liver|atay|(?:beef|pork|chicken|lamb)\s+kidneys?|kidney\s+meat|organ\s+meat|sardines?|sardinas|anchov(?:y|ies)|dilis|mackerel|herring|mussels?|tahong)\b/i.test(name);
}

function add(amount: RecordedAmount, nutrient: unknown): number | null {
  const n = numeric(nutrient);
  if (n === null) amount.missing++;
  else { amount.known++; amount.total += n; }
  return n;
}

/** No DB requests, background tasks, or AI estimates. Works on the actual snapshot. */
export function buildDashboardFoodInsights(
  meals: readonly DashboardFoodRecord[], today: string,
): DashboardFoodInsightSummary {
  const sodium: RecordedAmount = { total: 0, known: 0, missing: 0 };
  const addedSugar: RecordedAmount = { total: 0, known: 0, missing: 0 };
  const totalSugar: RecordedAmount = { total: 0, known: 0, missing: 0 };
  let todayMeals = 0;
  let foodCount = 0;
  let unknownFoodRows = 0;
  const found: FoodInsight[] = [];
  const seen = new Set<string>();
  const push = (item: FoodInsight) => {
    if (!seen.has(item.id)) { seen.add(item.id); found.push(item); }
  };

  for (const meal of meals) {
    if (typeof meal.consumed_at !== "string") continue;
    const timestamp = new Date(meal.consumed_at);
    if (!Number.isFinite(timestamp.getTime()) || phFoodDayKey(timestamp) !== today) continue;
    todayMeals++;
    const snapshot = isRecord(meal.analysis_snapshot) ? meal.analysis_snapshot : null;
    const foods = snapshot && Array.isArray(snapshot.foods)
      ? snapshot.foods.filter(isRecord) : [];
    if (foods.length === 0) {
      unknownFoodRows++;
      continue;
    }
    for (const food of foods) {
      foodCount++;
      const name = typeof food.name === "string" && food.name.trim()
        ? food.name.trim().slice(0, 100) : "A recorded food";
      const nutrients = isRecord(food.advancedNutrients) ? food.advancedNutrients : {};
      const sodiumMg = add(sodium, nutrients.sodiumMg);
      const addedSugarG = add(addedSugar, nutrients.addedSugarG);
      const sugarG = add(totalSugar, nutrients.sugarG);

      if (isPotentiallyPurineRichFood(name)) {
        push({ id: "purine", title: "Purine-related food reminder", category: "purine",
          description: `${name} may be relatively rich in purines. If you are managing gout or high uric acid, consider discussing food choices with a clinician. A food log cannot measure blood uric acid.`,
        });
      }
      if (sodiumMg !== null && sodiumMg >= DV_SODIUM_MG * 0.2) {
        push({ id: "sodium_food", title: "Sodium worth reviewing", category: "label",
          description: `${name} has ${fmt(sodiumMg)} mg recorded sodium, at least 20% of the general 2,300 mg Daily Value. Check the serving size and other foods eaten today.`,
        });
      }
      if (addedSugarG !== null && addedSugarG >= DV_ADDED_SUGAR_G * 0.2) {
        push({ id: "added_sugar_food", title: "Added sugar worth reviewing", category: "label",
          description: `${name} has ${fmt(addedSugarG)} g recorded added sugar, at least 20% of the general 50 g Daily Value. Compare portions and label information.`,
        });
      }
      // Not a high-sugar health claim: naturally occurring sugar is included.
      if (sugarG !== null && sugarG >= 25 && addedSugarG === null) {
        push({ id: "total_sugar_context", title: "Total sugar: check the type", category: "context",
          description: `${name} has ${fmt(sugarG)} g total sugar recorded. Some may be naturally occurring; added sugar is unknown, so this isn't an added-sugar warning.`,
        });
      }
    }
  }
  if (sodium.known && sodium.total >= DV_SODIUM_MG) {
    push({ id: "sodium_day", title: "Recorded sodium reached a full Daily Value", category: "label",
      description: `${fmt(sodium.total)} mg sodium is recorded today${sodium.missing ? " from foods with known values; the true total may be higher" : ""}. This general 2,300 mg reference is not a personal medical limit.`,
    });
  }
  if (addedSugar.known && addedSugar.total >= DV_ADDED_SUGAR_G) {
    push({ id: "added_sugar_day", title: "Recorded added sugar reached a full Daily Value", category: "label",
      description: `${fmt(addedSugar.total)} g added sugar is recorded today${addedSugar.missing ? " from foods with known values; the true total may be higher" : ""}. The 50 g reference is a general label value, not a personalized limit.`,
    });
  }
  // Keep the dashboard short. Prioritize concrete recorded data, then context.
  const order = ["sodium_day", "added_sugar_day", "sodium_food", "added_sugar_food", "purine", "total_sugar_context"];
  const sorted = found.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { todayMeals, foodCount, unknownFoodRows, sodium, addedSugar, totalSugar, notices: sorted.slice(0, 4) };
}
