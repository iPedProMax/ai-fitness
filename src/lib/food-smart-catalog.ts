import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publishedRowToFood, type PublishedPhilippineFood } from "@/lib/philippine-food-library";
import { foodMatchScore, smartFoodTokens } from "@/lib/food-smart-query";

const selection = "barcode,name,brand,serving_description,package_description,calories_100g,protein_100g,carbs_100g,fat_100g,advanced_nutrients_100g,source_kind,source_url,reviewed_at";

/** Queries the already-published rows only, with partial/multiword brand+name matching. */
export async function suggestReviewedFoods(input: string): Promise<PublishedPhilippineFood[]> {
  const tokens = smartFoodTokens(input);
  if (!tokens.length) return [];
  const first = tokens[0]; // Normalized: letters, numbers, or hyphens. No PostgREST grammar.
  try {
    const db = await createClient();
    const pattern = `%${first}%`;
    const { data, error } = await db.from("khalories_ph_food_library")
      .select(selection)
      .eq("status", "published")
      .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data.map(publishedRowToFood)
      .filter((food): food is PublishedPhilippineFood => food !== null)
      .filter(food => foodMatchScore(food, input) > 0)
      .sort((a, b) => foodMatchScore(b, input) - foodMatchScore(a, input))
      .slice(0, 8);
  } catch { return []; }
}
