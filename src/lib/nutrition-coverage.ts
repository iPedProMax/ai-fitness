/** A named product is not necessarily a product with known nutrition facts.
 * Blank/null nutrients are unknown; zero is a valid known quantity.
 * For catalog and reviewed user data, all core nutrients are portion values.
 */
export const CORE_BARCODE_NUTRIENTS = ["calories", "protein", "carbs", "fat"] as const;
export type CoreBarcodeNutrient = typeof CORE_BARCODE_NUTRIENTS[number];

export function barcodeNutritionCoverage(
  values: Partial<Record<CoreBarcodeNutrient, string | number | null | undefined>>,
) {
  const known = CORE_BARCODE_NUTRIENTS.filter(key => {
    const raw = values[key];
    if (raw === null || raw === undefined || raw === "") return false;
    if (typeof raw === "string" && !raw.trim()) return false;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0;
  });
  const missing = CORE_BARCODE_NUTRIENTS.filter(key => !known.includes(key));
  return { known, missing, allKnown: missing.length === 0, anyKnown: known.length > 0 };
}
