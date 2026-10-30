/** Data from Open Food Facts is community supplied, not clinically verified. */
export type CatalogFood = {
  barcode: string;
  name: string;
  brand: string;
  servingDescription: string;
  packageDescription?: string;
  calories100g: number | null;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
};

export function validBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value);
}
function nutrient(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "" || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
}
function label(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0,max) : "";
}
export function parseOpenFoodFactsProduct(input: unknown): CatalogFood | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const n = p.nutriments && typeof p.nutriments === "object" ? p.nutriments as Record<string, unknown> : {};
  const barcode = label(p.code,14);
  const name = label(p.product_name_en || p.product_name,110);
  if (!validBarcode(barcode) || !name) return null;
  let calories = nutrient(n["energy-kcal_100g"]);
  if (calories === null) {
    const kj = nutrient(n["energy-kj_100g"]);
    calories = kj !== null ? Math.round((kj / 4.184) * 10) / 10 : null;
  }
  return {
    barcode, name,
    brand: label(p.brands,80),
    servingDescription: label(p.serving_size,80),
    packageDescription: label(p.quantity,80),
    calories100g:calories,
    protein100g:nutrient(n.proteins_100g),
    carbs100g:nutrient(n.carbohydrates_100g),
    fat100g:nutrient(n.fat_100g),
  };
}
export function nutritionForGrams(food: CatalogFood, grams: number) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 2000) throw new Error("Enter a portion from 1 to 2,000 grams.");
  const scale = (n: number | null) => n === null ? "" : String(Math.round(n * grams / 100 * 10) / 10);
  return {
    name: (food.brand ? `${food.name} (${food.brand})` : food.name).slice(0,120),
    grams: String(grams), calories: scale(food.calories100g),
    protein:scale(food.protein100g), carbs:scale(food.carbs100g),fat:scale(food.fat100g),
  };
}
