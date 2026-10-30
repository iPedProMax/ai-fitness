import { z } from "zod";
import type { CatalogFood } from "@/lib/open-food-facts";
import type { ManualFoodInput } from "@/lib/manual-food";

// These values are user-reviewed entries, not professionally verified nutrition.
export const personalBarcodeFoodSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string().trim().min(1).max(110),
  brand: z.string().max(80),
  servingDescription: z.string().max(80),
  packageDescription: z.string().max(80),
  calories100g: z.number().finite().min(0).max(1200),
  protein100g: z.number().finite().min(0).max(100).nullable(),
  carbs100g: z.number().finite().min(0).max(100).nullable(),
  fat100g: z.number().finite().min(0).max(100).nullable(),
  source: z.enum(["user_reviewed", "ai_reviewed"]),
}).strict();
export type PersonalBarcodeFoodInput = z.infer<typeof personalBarcodeFoodSchema>;

/** A blank macro means unknown, NEVER zero. All values are for the entered serving. */
export function personalFoodFromServing(
  base: Pick<CatalogFood,"barcode"|"name"|"brand"|"servingDescription"|"packageDescription">,
  servingGrams: number,
  values: Pick<ManualFoodInput,"calories"|"protein"|"carbs"|"fat">,
  source: PersonalBarcodeFoodInput["source"],
): PersonalBarcodeFoodInput {
  if (!Number.isFinite(servingGrams) || servingGrams < 1 || servingGrams > 2000) {
    throw new Error("Enter the actual serving weight in grams to remember this barcode.");
  }
  const convert = (value: string, required: boolean, label: string): number | null => {
    const trimmed=value.trim();
    if (!trimmed) {
      if (required) throw new Error("Calories are required to save a personal barcode food.");
      return null;
    }
    const numeric=Number(trimmed);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error(`Check ${label}; enter a nonnegative number.`);
    return Math.round(numeric * 100 / servingGrams * 1000) / 1000;
  };
  return personalBarcodeFoodSchema.parse({
    ...base,
    packageDescription:base.packageDescription??"",
    calories100g:convert(values.calories,true,"calories"),
    protein100g:convert(values.protein,false,"protein"),
    carbs100g:convert(values.carbs,false,"carbs"),
    fat100g:convert(values.fat,false,"fat"),
    source,
  });
}

export function savedRowToCatalog(input: unknown): CatalogFood | null {
  if (!input || typeof input !== "object") return null;
  const row=input as Record<string, unknown>;
  const numeric=(value:unknown)=> typeof value === "string" && value.trim()!=="" ? Number(value) : value;
  const parsed=personalBarcodeFoodSchema.safeParse({
    barcode:row.barcode,name:row.name,brand:row.brand,
    servingDescription:row.serving_description,packageDescription:row.package_description,
    calories100g:numeric(row.calories_100g),protein100g:numeric(row.protein_100g),
    carbs100g:numeric(row.carbs_100g),fat100g:numeric(row.fat_100g),source:row.source,
  });
  if(!parsed.success)return null;
  return {
    barcode:parsed.data.barcode, name:parsed.data.name, brand:parsed.data.brand,
    servingDescription:parsed.data.servingDescription,
    packageDescription:parsed.data.packageDescription,
    calories100g:parsed.data.calories100g,protein100g:parsed.data.protein100g,
    carbs100g:parsed.data.carbs100g,fat100g:parsed.data.fat100g,
  };
}
