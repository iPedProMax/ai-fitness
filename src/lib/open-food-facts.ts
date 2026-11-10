import type { AdvancedNutrients } from "./advanced-nutrients";
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
  advancedNutrients100g?: AdvancedNutrients;
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
/** Prefer OFF normalized per-100g; use its per-serving numbers only when the
 *  label has an explicit gram/mL weight. Never infer a weight from "1 cup".
 */
function servingWeight(p: Record<string, unknown>): number | null {
  const normalized = nutrient(p.serving_quantity);
  if (normalized !== null && normalized >= 1 && normalized <= 2000) return normalized;
  const serving = typeof p.serving_size === "string" ? p.serving_size : "";
  const match = serving.match(/(?:^|[^\da-z])(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/i);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 2000 ? n : null;
}
export function parseOpenFoodFactsProduct(input: unknown): CatalogFood | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const n = p.nutriments && typeof p.nutriments === "object" ? p.nutriments as Record<string, unknown> : {};
  const barcode = label(p.code,14);
  const name = label(p.product_name_en || p.product_name,110);
  if (!validBarcode(barcode) || !name) return null;
  const grams = servingWeight(p);
  const servingTo100g = (key: string): number | null => {
    if (grams === null) return null;
    const perServing = nutrient(n[`${key}_serving`]);
    if (perServing === null) return null;
    return Math.round(perServing * 100 / grams * 100) / 100;
  };
  let calories = nutrient(n["energy-kcal_100g"]) ?? servingTo100g("energy-kcal");
  if (calories === null) {
    const kj = nutrient(n["energy-kj_100g"]) ?? nutrient(n["energy_100g"]) ?? servingTo100g("energy-kj") ?? servingTo100g("energy");
    calories = kj !== null ? Math.round((kj / 4.184) * 10) / 10 : null;
  }
  const fromG=(key:string):number|null=>
    nutrient(n[key]) ?? (key.endsWith("_100g") ? servingTo100g(key.slice(0,-5)) : null);
  // OFF normalized fields are grams per 100g for minerals, sodium and cholesterol.
  const mgFromG=(key:string):number|null=>{const v=fromG(key);return v===null?null:Math.round(v*100000)/100;};
  const advanced:AdvancedNutrients={};
  const candidates = {
    fiberG: fromG("fiber_100g"), sugarG: fromG("sugars_100g"),
    addedSugarG: fromG("added-sugars_100g") ?? fromG("added_sugars_100g"),
    sodiumMg: mgFromG("sodium_100g") ?? (fromG("salt_100g")===null?null:Math.round(fromG("salt_100g")!*1000/2.5*10)/10),
    cholesterolMg: mgFromG("cholesterol_100g"), potassiumMg: mgFromG("potassium_100g"),
    calciumMg: mgFromG("calcium_100g"), ironMg: mgFromG("iron_100g"),
    vitaminDMcg: fromG("vitamin-d_100g")===null?null:Math.round(fromG("vitamin-d_100g")!*1000000*100)/100,
  };
  for(const key of Object.keys(candidates) as Array<keyof typeof candidates>){
    const value=candidates[key];
    const max=key==="vitaminDMcg"?1000:key.endsWith("Mg")?100000:1000;
    if(value!==null&&Number.isFinite(value)&&value>=0&&value<=max)advanced[key]=value;
  }
  if(advanced.sugarG!==undefined&&advanced.sugarG>(nutrient(n.carbohydrates_100g)??Infinity)+0.5)delete advanced.sugarG;
  if(advanced.addedSugarG!==undefined&&(
    advanced.addedSugarG>(nutrient(n.carbohydrates_100g)??Infinity)+0.5 ||
    (advanced.sugarG!==undefined&&advanced.addedSugarG>advanced.sugarG+0.1)
  ))delete advanced.addedSugarG;
  return {
    barcode, name,
    brand: label(p.brands,80),
    servingDescription: label(p.serving_size,80),
    packageDescription: label(p.quantity,80),
    calories100g:calories,
    protein100g:fromG("proteins_100g"),
    carbs100g:fromG("carbohydrates_100g"),
    fat100g:fromG("fat_100g"),
    ...(Object.keys(advanced).length ? {advancedNutrients100g:advanced} : {}),
  };
}
export function nutritionForGrams(food: CatalogFood, grams: number) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 2000) throw new Error("Enter a portion from 1 to 2,000 grams.");
  const scale = (n: number | null) => n === null ? "" : String(Math.round(n * grams / 100 * 10) / 10);
  const advanced=Object.fromEntries(Object.entries(food.advancedNutrients100g??{}).map(([key,value]) => [key,scale(value)]));
  return {
    ...advanced,
    name: (food.brand ? `${food.name} (${food.brand})` : food.name).slice(0,120),
    grams: String(grams), calories: scale(food.calories100g),
    protein:scale(food.protein100g), carbs:scale(food.carbs100g),fat:scale(food.fat100g),
  };
}
