import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { publishedRowToFood } from "./philippine-food-library";

const row = {
  barcode: "4801234567890", name: "Sample Reviewed Product", brand: "Example",
  serving_description: "40 g", package_description: "40 g",
  calories_100g: "250", protein_100g: "10", carbs_100g: "30", fat_100g: "8",
  advanced_nutrients_100g: { fiberG: 2, sodiumMg: 400, fakeData: 900 },
  source_kind: "reviewed_package_label", reviewed_at: "2026-11-03T09:00:00Z",
  source_url: "https://example.com/reviewed-packaging",
};

describe("Z3.2 published Philippine food row validation", () => {
  it("converts a reviewed row into the existing CatalogFood shape", () => {
    const food = publishedRowToFood(row);
    expect(food).toMatchObject({barcode: row.barcode, calories100g: 250, protein100g: 10});
    expect(food?.advancedNutrients100g).toEqual({fiberG:2, sodiumMg:400});
  });
  it("rejects invalid or anonymous product records", () => {
    expect(publishedRowToFood({...row, barcode: "not-barcode"})).toBeNull();
    expect(publishedRowToFood({...row, reviewed_at: null})).toBeNull();
    expect(publishedRowToFood({...row, source_kind: "ai_estimate"})).toBeNull();
    expect(publishedRowToFood({...row, calories_100g: null, protein_100g: null})).toBeNull();
  });
  it("leaves missing nutrients unknown, never zero", () => {
    const food = publishedRowToFood({...row, fat_100g:null, calories_100g: 190});
    expect(food?.fat100g).toBeNull();
    expect(food?.advancedNutrients100g).toEqual({fiberG:2,sodiumMg:400});
  });
});
