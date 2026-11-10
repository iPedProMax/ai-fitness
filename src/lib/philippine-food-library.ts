import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validBarcode, type CatalogFood } from "@/lib/open-food-facts";

/** Curated independent package/manufacturer labels, not Open Food Facts imports. */
type ReviewedRow = {
  barcode: unknown;
  name: unknown;
  brand: unknown;
  serving_description: unknown;
  package_description: unknown;
  calories_100g: unknown;
  protein_100g: unknown;
  carbs_100g: unknown;
  fat_100g: unknown;
  advanced_nutrients_100g: unknown;
  source_kind: unknown;
  source_url: unknown;
  reviewed_at: unknown;
};
const approvedAdvanced = [
  "fiberG", "sugarG", "addedSugarG", "sodiumMg", "cholesterolMg",
  "potassiumMg", "calciumMg", "ironMg", "vitaminDMcg",
] as const;

function numeric(value: unknown, maximum = 100000): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 && result <= maximum ? result : null;
}

export type PublishedPhilippineFood = CatalogFood & {
  librarySource: "manufacturer_label" | "reviewed_package_label";
  reviewedAt: string;
  sourceUrl?: string;
};

/** Reject incomplete, unreviewed or malformed rows before returning a product. */
export function publishedRowToFood(input: unknown): PublishedPhilippineFood | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as ReviewedRow;
  const barcode = typeof row.barcode === "string" ? row.barcode : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!validBarcode(barcode) || name.length < 2 || name.length > 120) return null;
  if (row.source_kind !== "manufacturer_label" && row.source_kind !== "reviewed_package_label") return null;
  if (typeof row.reviewed_at !== "string" || !Number.isFinite(Date.parse(row.reviewed_at))) return null;
  const calories = numeric(row.calories_100g, 2000);
  const protein = numeric(row.protein_100g, 100);
  const carbs = numeric(row.carbs_100g, 100);
  const fat = numeric(row.fat_100g, 100);
  if (calories === null && (protein === null || carbs === null || fat === null)) return null;
  const raw = row.advanced_nutrients_100g;
  const advanced = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const safeAdvanced: Partial<Record<(typeof approvedAdvanced)[number], number>> = {};
  for (const key of approvedAdvanced) {
    const value = numeric(advanced[key], key.endsWith("Mg") ? 100000 : 1000);
    if (value !== null) safeAdvanced[key] = value;
  }
  const limited = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
  const url = typeof row.source_url === "string" && /^https:\/\//.test(row.source_url) ? row.source_url.slice(0, 500) : undefined;
  return {
    barcode, name, brand: limited(row.brand, 80),
    servingDescription: limited(row.serving_description, 80),
    packageDescription: limited(row.package_description, 80),
    calories100g: calories, protein100g: protein, carbs100g: carbs, fat100g: fat,
    ...(Object.keys(safeAdvanced).length ? { advancedNutrients100g: safeAdvanced } : {}),
    librarySource: row.source_kind, reviewedAt: row.reviewed_at,
    ...(url ? { sourceUrl: url } : {}),
  };
}

const selection = "barcode,name,brand,serving_description,package_description,calories_100g,protein_100g,carbs_100g,fat_100g,advanced_nutrients_100g,source_kind,source_url,reviewed_at";

/** No service-role key. RLS returns published records only, and failure falls back to OFF. */
export async function findReviewedPhilippineFoods(kind: "barcode" | "search", value: string): Promise<PublishedPhilippineFood[]> {
  try {
    const db = await createClient();
    const base = db.from("khalories_ph_food_library").select(selection).eq("status", "published");
    const query = kind === "barcode"
      ? base.eq("barcode", value).limit(1)
      : base.ilike("name", `%${value.replace(/[%_\\]/g, "").trim()}%`).limit(8);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return data.map(publishedRowToFood).filter((entry): entry is PublishedPhilippineFood => entry !== null);
  } catch { return []; }
}
