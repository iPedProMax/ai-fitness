/** Khalories: reference-based manual calculator. Does NOT call an AI or persist anything.
 * USDA FoodData Central SR Legacy values are per 100 g of the described EDIBLE food.
 * All non-fruit reference records include the source FDC ID. Avoid misleading
 * precision: the prepared/cooked/raw distinction and any added oil matter.
 */
import { manualFruits } from "./manual-fruit-catalog";

export type QuickNutritionUnit = "g" | "oz" | "mL";
export type QuickFoodCategory = "Fruit" | "Everyday" | "Drink";
export type QuickFood = {
  id: string;
  name: string;
  category: QuickFoodCategory;
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g: number | null;
  sugar100g: number | null;
  aliases: string[];
  source: string;
  sourceUrl: string;
  /** only for actual liquid foods; a measured or sourced APPROXIMATE density */
  densityGPerMl?: number;
};

const usda = (fdcId: number) => `USDA FoodData Central SR Legacy · FDC ${fdcId}`;
const url = (fdcId: number) => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
const staples: QuickFood[] = [
  // USDA SR Legacy raw oats: generic dry grain, NOT a particular Quaker flavor or cooked oatmeal.
  { id:"staple-oats-dry-raw",name:"Oats (raw, dry; generic)",category:"Everyday",kcal100g:389,protein100g:16.89,carbs100g:66.27,fat100g:6.90,fiber100g:10.6,sugar100g:null,aliases:["oats","rolled oats","dry oats","raw oats","oatmeal dry"],source:usda(169705),sourceUrl:url(169705) },
  { id:"staple-rice-white-cooked",name:"White rice (cooked, plain)",category:"Everyday",kcal100g:130,protein100g:2.69,carbs100g:28.17,fat100g:0.28,fiber100g:0.4,sugar100g:0.05,aliases:["rice","kanin","white rice","steamed rice"],source:usda(168878),sourceUrl:url(168878) },
  { id:"staple-rice-brown-cooked",name:"Brown rice (cooked, plain)",category:"Everyday",kcal100g:112,protein100g:2.32,carbs100g:23.51,fat100g:0.83,fiber100g:1.8,sugar100g:0,aliases:["brown rice","brown kanin"],source:usda(168875),sourceUrl:url(168875) },
  { id:"staple-egg-boiled",name:"Egg (hard-boiled, peeled)",category:"Everyday",kcal100g:155,protein100g:12.58,carbs100g:1.12,fat100g:10.61,fiber100g:0,sugar100g:1.12,aliases:["egg","eggs","boiled egg","itlog"],source:usda(173424),sourceUrl:url(173424) },
  { id:"staple-chicken-breast-roasted",name:"Chicken breast (roasted, skinless)",category:"Everyday",kcal100g:165,protein100g:31.02,carbs100g:0,fat100g:3.57,fiber100g:0,sugar100g:0,aliases:["chicken","chicken breast","manok"],source:usda(171477),sourceUrl:url(171477) },
  { id:"staple-potato-baked",name:"Potato (baked, with skin)",category:"Everyday",kcal100g:93,protein100g:2.5,carbs100g:21.15,fat100g:0.13,fiber100g:null,sugar100g:null,aliases:["potato","patatas","baked potato"],source:usda(170093),sourceUrl:url(170093) },
  { id:"staple-sweet-potato-baked",name:"Sweet potato (baked, flesh)",category:"Everyday",kcal100g:90,protein100g:2.01,carbs100g:20.71,fat100g:0.15,fiber100g:3.3,sugar100g:null,aliases:["sweet potato","kamote","camote"],source:usda(168483),sourceUrl:url(168483) },
  { id:"drink-milk-whole",name:"Whole milk (plain, 3.25% fat)",category:"Drink",kcal100g:61,protein100g:3.15,carbs100g:4.8,fat100g:3.25,fiber100g:0,sugar100g:5.05,aliases:["milk","gatas","whole milk"],source:usda(171265),sourceUrl:url(171265),densityGPerMl:1.03 },
  { id:"drink-coffee-black",name:"Black coffee (brewed, no sugar)",category:"Drink",kcal100g:1,protein100g:0.12,carbs100g:0,fat100g:0.02,fiber100g:0,sugar100g:0,aliases:["coffee","kape","black coffee"],source:usda(171890),sourceUrl:url(171890),densityGPerMl:1.00 },
  { id:"drink-juice-orange",name:"Orange juice (raw, unsweetened)",category:"Drink",kcal100g:45,protein100g:0.7,carbs100g:10.4,fat100g:0.2,fiber100g:0.2,sugar100g:8.4,aliases:["orange juice","juice","fresh orange juice"],source:usda(169098),sourceUrl:url(169098),densityGPerMl:1.05 },
  { id:"drink-water",name:"Plain water",category:"Drink",kcal100g:0,protein100g:0,carbs100g:0,fat100g:0,fiber100g:0,sugar100g:0,aliases:["water","tubig"],source:"Physical reference: water contains no food energy",sourceUrl:"https://fdc.nal.usda.gov/",densityGPerMl:1.00 },
];

export const quickFoods: readonly QuickFood[] = [
  ...staples,
  ...manualFruits.map(fruit => ({
    id: `fruit-${fruit.id}`,
    name: fruit.name,
    category: "Fruit" as const,
    kcal100g: fruit.calories100g,
    protein100g: fruit.protein100g,
    carbs100g: fruit.carbs100g,
    fat100g: fruit.fat100g,
    fiber100g: fruit.fiber100g,
    sugar100g: fruit.sugar100g,
    aliases: fruit.aliases,
    source: fruit.source,
    sourceUrl: "https://fdc.nal.usda.gov/download-datasets/",
  })),
];

export function findQuickFoodById(id: string): QuickFood | undefined {
  return quickFoods.find(food => food.id === id);
}

export function searchQuickFoods(query: string, category: "All" | QuickFoodCategory = "All", limit = 12): QuickFood[] {
  const needle = query.trim().normalize("NFKD").toLowerCase();
  const filtered = quickFoods.filter(food => category === "All" || food.category === category);
  if (!needle) return filtered.slice(0, limit);
  return filtered.flatMap(food => {
    const name = food.name.toLowerCase();
    const aliases = food.aliases.map(alias => alias.toLowerCase());
    const score = name.startsWith(needle) ? 0 : aliases.some(a => a === needle) ? 1
      : aliases.some(a => a.startsWith(needle)) ? 2 : name.includes(needle) ? 3
      : aliases.some(a => a.includes(needle)) ? 4 : -1;
    return score < 0 ? [] : [{ food, score }];
  }).sort((a,b) => a.score - b.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit).map(item => item.food);
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function quickNutrition(food: QuickFood, quantity: number, unit: QuickNutritionUnit) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) throw new Error("Enter a positive quantity up to 5000.");
  if (unit !== "g" && unit !== "oz" && unit !== "mL") throw new Error("Unsupported measurement unit.");
  if (unit === "mL" && (food.category !== "Drink" || food.densityGPerMl === undefined)) {
    throw new Error("mL is only supported for drinks with an appropriate density reference. Choose grams or weight ounces.");
  }
  const grams = unit === "g" ? quantity : unit === "oz" ? quantity * 28.349523125 : quantity * food.densityGPerMl!;
  if (grams > 5000) throw new Error("The selected portion exceeds 5000 grams.");
  const scale = (n: number | null) => n === null ? null : round2(n * grams / 100);
  return {
    grams: round2(grams),
    calories: scale(food.kcal100g)!,
    protein: scale(food.protein100g)!,
    carbs: scale(food.carbs100g)!,
    fat: scale(food.fat100g)!,
    fiberG: scale(food.fiber100g),
    sugarG: scale(food.sugar100g),
  };
}
