import type { CatalogFood } from "./open-food-facts";

/**
 * A small evidence-backed fallback for an exact PH barcode whose upstream record
 * may return a product name but no nutrient fields. This is community data,
 * NOT manufacturer-verified. Do not infer other barcodes/flavors from the name.
 */
export type ReferencedCatalogFood = CatalogFood & {
  nutritionSourceUrl?: string;
  nutritionSourceLabel?: string;
};

const references: Record<string, ReferencedCatalogFood> = {
  "4800016552113": {
    barcode: "4800016552113",
    name: "Nissin Cup Noodles Mini Seafood Flavor",
    brand: "Nissin",
    servingDescription: "40 g",
    packageDescription: "40 g",
    // Per-100g community record keyed by this exact PH barcode, not an AI estimate.
    calories100g: 425,
    protein100g: 10,
    carbs100g: 60,
    fat100g: 17.5,
    advancedNutrients100g: {
      sugarG: 5,
      fiberG: 2.5,
      // Community source: 6.6g salt / 100g => approx. 2640mg sodium / 100g.
      sodiumMg: 2640,
    },
    nutritionSourceUrl: "https://nutrifoodindex.com/product/nissin-cup-noodles-mini-seafood-flavor",
    nutritionSourceLabel: "Exact-barcode community nutrition record (not verified against package)",
  },
  "4807770272646": {
    barcode: "4807770272646",
    name: "Lucky Me! Supreme Jjampong",
    brand: "Lucky Me!",
    servingDescription: "70 g",
    packageDescription: "70 g",
    calories100g: 460,
    protein100g: 7.1,
    carbs100g: 60,
    fat100g: 21.4,
    advancedNutrients100g: {
      fiberG: 7.1,
      sugarG: 5.7,
      // 6.7 g salt per 100 g / 2.5 * 1000 mg = approx 2680 mg sodium.
      sodiumMg: 2680,
    },
    nutritionSourceUrl: "https://nutrifoodindex.com/product/supreme-jjampong",
    nutritionSourceLabel: "Community nutrient record (not a verified package label)",
  },
};

export function findReferencedBarcode(code: string): ReferencedCatalogFood | null {
  const record = references[code];
  return record ? { ...record, advancedNutrients100g: { ...record.advancedNutrients100g } } : null;
}

/** Never overwrite existing numbers, including zero; fill missing fields only. */
export function supplementExactBarcodeFood(food: CatalogFood): ReferencedCatalogFood {
  const reference = findReferencedBarcode(food.barcode);
  if (!reference) return food;
  const additions = (["calories100g", "protein100g", "carbs100g", "fat100g"] as const)
    .some(key => food[key] == null && reference[key] != null);
  const incomingAdvanced = Object.entries(reference.advancedNutrients100g ?? {}).some(
    ([key, value]) => (food.advancedNutrients100g as Record<string, number | undefined> | undefined)?.[key] == null && value != null,
  );
  if (!additions && !incomingAdvanced) return food;
  return {
    ...food,
    calories100g: food.calories100g ?? reference.calories100g,
    protein100g: food.protein100g ?? reference.protein100g,
    carbs100g: food.carbs100g ?? reference.carbs100g,
    fat100g: food.fat100g ?? reference.fat100g,
    advancedNutrients100g: {
      ...reference.advancedNutrients100g,
      ...food.advancedNutrients100g,
    },
    nutritionSourceUrl: reference.nutritionSourceUrl,
    nutritionSourceLabel: reference.nutritionSourceLabel,
  };
}
