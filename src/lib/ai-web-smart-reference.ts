/** Human-approved reference nutrition for AI Web Import. This module makes NO AI calls. */
import type { ManualFoodInput } from "./manual-food";
import { searchQuickFoods, type QuickFood } from "./quick-nutrition-calculator";

export const REFERENCE_NUTRIENT_KEYS = [
  "calories", "protein", "carbs", "fat", "fiberG", "sugarG", "saturatedFatG",
  "addedSugarG", "sodiumMg", "cholesterolMg", "potassiumMg", "calciumMg",
  "ironMg", "vitaminDMcg",
] as const satisfies ReadonlyArray<keyof ManualFoodInput>;
export type ReferenceNutrientKey = (typeof REFERENCE_NUTRIENT_KEYS)[number];
export type ReferenceOrigin = "USDA_LOCAL" | "CATALOG";
export type SmartFoodReference = {
  id: string;
  name: string;
  brand: string;
  origin: ReferenceOrigin;
  source: string;
  sourceUrl?: string;
  per100g: Record<ReferenceNutrientKey, number | null>;
};

const OPTIONAL_NUTRIENT_KEYS: ReadonlyArray<ReferenceNutrientKey> = REFERENCE_NUTRIENT_KEYS;
function per100gNumber(value: unknown, key: ReferenceNutrientKey): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const ceiling = key === "calories" ? 900 : key.endsWith("Mg") ? 100000 : key === "vitaminDMcg" ? 1000 : 100;
  return value <= ceiling ? value : null;
}
function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function limitedString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function mapLocalFood(food: QuickFood): SmartFoodReference {
  const nutrients = Object.fromEntries(OPTIONAL_NUTRIENT_KEYS.map(key => [key, null])) as Record<ReferenceNutrientKey, number | null>;
  nutrients.calories = food.kcal100g;
  nutrients.protein = food.protein100g;
  nutrients.carbs = food.carbs100g;
  nutrients.fat = food.fat100g;
  nutrients.fiberG = food.fiber100g;
  nutrients.sugarG = food.sugar100g;
  return { id: `local:${food.id}`, name: food.name, brand: "", origin: "USDA_LOCAL", source: food.source, sourceUrl: food.sourceUrl, per100g: nutrients };
}

/** Only candidate suggestions. Never assume these are the same product as an imported AI food. */
export function findLocalSmartReferences(query: string): SmartFoodReference[] {
  const clean = query.trim().slice(0, 60);
  if (clean.length < 2) return [];
  const direct = searchQuickFoods(clean, "All", 8);
  if (direct.length) return direct.map(mapLocalFood);
  // Useful for "Dry rolled oats" or "Quaker quick oats": suggest generic oats,
  // but ALWAYS require explicit user selection and display the source name.
  const words = clean.toLowerCase().match(/[a-z]{3,}/g)?.slice(0, 8) ?? [];
  const candidates = words.flatMap(word => searchQuickFoods(word, "All", 5));
  const unique = new Map<string, QuickFood>();
  for (const food of candidates) if (!unique.has(food.id)) unique.set(food.id, food);
  return [...unique.values()].slice(0, 8).map(mapLocalFood);
}

/** Defensive parsing: catalog data can come from reviewed labels or community data. */
export function readCatalogSmartReferences(input: unknown): SmartFoodReference[] {
  const body = objectOf(input);
  if (!body || !Array.isArray(body.foods)) return [];
  const source = limitedString(body.source, 120) || "Food catalog (check packaging)";
  const seen = new Set<string>();
  const results: SmartFoodReference[] = [];
  for (const raw of body.foods.slice(0, 16)) {
    const food = objectOf(raw);
    if (!food) continue;
    const name = limitedString(food.name, 120);
    const brand = limitedString(food.brand, 80);
    if (name.length < 2) continue;
    const advanced = objectOf(food.advancedNutrients100g) ?? {};
    const nutrients = Object.fromEntries(OPTIONAL_NUTRIENT_KEYS.map(key => [key, null])) as Record<ReferenceNutrientKey, number | null>;
    nutrients.calories = per100gNumber(food.calories100g, "calories");
    nutrients.protein = per100gNumber(food.protein100g, "protein");
    nutrients.carbs = per100gNumber(food.carbs100g, "carbs");
    nutrients.fat = per100gNumber(food.fat100g, "fat");
    for (const key of OPTIONAL_NUTRIENT_KEYS.slice(4)) nutrients[key] = per100gNumber(advanced[key], key);
    if (!OPTIONAL_NUTRIENT_KEYS.some(key => nutrients[key] !== null)) continue;
    // Reject egregious catalog inconsistencies rather than propagating them.
    if (nutrients.carbs !== null && nutrients.sugarG !== null && nutrients.sugarG > nutrients.carbs + 1) nutrients.sugarG = null;
    if (nutrients.carbs !== null && nutrients.fiberG !== null && nutrients.fiberG > nutrients.carbs + 1) nutrients.fiberG = null;
    if (nutrients.addedSugarG !== null && nutrients.sugarG !== null && nutrients.addedSugarG > nutrients.sugarG + 1) nutrients.addedSugarG = null;
    const normalized = `${name.toLowerCase()}|${brand.toLowerCase()}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const url = limitedString(food.sourceUrl ?? food.nutritionSourceUrl, 500);
    results.push({
      id: `catalog:${results.length}:${normalized.slice(0, 80)}`,
      name, brand, origin: "CATALOG", source,
      ...(url.startsWith("https://") ? { sourceUrl: url } : {}),
      per100g: nutrients,
    });
    if (results.length === 8) break;
  }
  return results;
}

export type SmartFillMode = "missing" | "replace";
export function applySmartFoodReference(
  current: ManualFoodInput,
  reference: SmartFoodReference,
  confirmedNetWeight: boolean,
  mode: SmartFillMode = "missing",
): { item: ManualFoodInput; filled: ReferenceNutrientKey[] } {
  if (!confirmedNetWeight) throw new Error("Confirm net food weight (excluding bowl/packaging) before using a nutrition reference.");
  const weightText = current.grams.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(weightText)) throw new Error("Enter the net food weight in grams first.");
  const grams = Number(weightText);
  if (!Number.isFinite(grams) || grams <= 0 || grams > 2000) throw new Error("Enter a confirmed net food weight between 0 and 2,000 g.");
  const item: ManualFoodInput = { ...current };
  const filled: ReferenceNutrientKey[] = [];
  const factor = grams / 100;
  for (const key of REFERENCE_NUTRIENT_KEYS) {
    const per100g = reference.per100g[key];
    if (per100g === null || !Number.isFinite(per100g) || per100g < 0) continue;
    if (mode === "missing" && String(item[key] ?? "").trim() !== "") continue;
    const scaled = Math.round((per100g * factor + Number.EPSILON) * 100) / 100;
    item[key] = String(scaled);
    filled.push(key);
  }
  return { item, filled };
}
