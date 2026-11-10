/**
 * Phase U10A: advisory reference checks for selected, narrowly matched foods.
 * Reference values: USDA FoodData Central SR Legacy, cooked long-grain white
 * rice ~130 kcal/100 g (FDC 169757); hard-boiled whole egg ~155 kcal/100 g
 * (FDC 173424). This is NOT an authoritative lookup for other preparations.
 *
 * Warning-only, with no price, cloud calls, silent edits, or credit usage.
 * A calorie/macro arithmetic check alone cannot catch a plausible-looking
 * but inaccurate food-specific estimate (e.g. low calories AND low carbs).
 */
export type NutritionReferenceRow = {
  name: string;
  grams: string;
  calories: string;
};

const number = (input: string): number | null => {
  if (!input.trim()) return null;
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** Advisory thresholds intentionally broad to avoid overriding recipe variation. */
export function findNutritionReferenceWarnings(rows: readonly NutritionReferenceRow[]): string[] {
  const warnings: string[] = [];
  for (const row of rows) {
    const grams = number(row.grams);
    const calories = number(row.calories);
    if (grams === null || calories === null || grams < 25 || grams > 1000) continue;
    const name = row.name.trim().toLowerCase();
    const density = calories / grams * 100;
    // Plain, cooked WHITE rice only; not rice porridge, fried rice, rice in sauce,
    // raw rice, or sticky/coconut rice, which differ significantly in water/fat.
    if (/\bwhite\s+rice\b/.test(name) && /\b(cooked|steamed|boiled)\b/.test(name) &&
      !/\b(fried|porridge|congee|lugaw|raw|uncooked|dry|glutinous|sticky|coconut|milk)\b/.test(name) &&
      Math.abs(density - 130) / 130 > 0.2) {
      warnings.push(`${row.name}: ${Math.round(density)} kcal/100 g is notably different from a common USDA cooked white-rice reference (~130 kcal/100 g). Check that your weight is COOKED and review the estimate.`);
      continue;
    }
    // Matches only boiled whole eggs; no yolk-only, whites-only, or fried eggs.
    if (/\b(boiled|hard.boiled)\b/.test(name) && /\begg\b/.test(name) &&
      !/\b(white only|egg white|yolk only|egg yolk|fried)\b/.test(name) &&
      Math.abs(density - 155) / 155 > 0.3) {
      warnings.push(`${row.name}: ${Math.round(density)} kcal/100 g is far from a typical USDA whole hard-boiled egg (~155 kcal/100 g). Verify edible portion and serving size.`);
    }
  }
  return warnings.slice(0, 5);
}