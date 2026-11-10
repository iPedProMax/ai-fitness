import type { FoodAnalysis } from "@/lib/food-analysis";

/**
 * Product-name AI is a rough ESTIMATE, not a label transcription.
 * Only calories and macros are eligible for autofill. Other label-dependent
 * fields stay unknown unless provided by a catalog or the person reviewing.
 */
export const BARCODE_TEXT_AI_FIELDS = ["calories", "protein", "carbs", "fat"] as const;
type BarcodeTextAiField = typeof BARCODE_TEXT_AI_FIELDS[number];
type Suggested = FoodAnalysis["foods"][number];

function known(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  return typeof value === "string" && value.trim() !== "" &&
    Number.isFinite(Number(value)) && Number(value) >= 0;
}

/** Never overwrite known label/user values, and never turn unknown macros into zero. */
export function missingBarcodeTextAiDraft(
  current: Record<string, unknown>, food: Suggested, actualGrams: number | null,
): Partial<Record<BarcodeTextAiField, string>> {
  const originalGrams = Number(food.estimatedGrams);
  const targetGrams = actualGrams !== null && Number.isFinite(actualGrams) && actualGrams > 0
    ? actualGrams : null;
  if (targetGrams !== null && (!Number.isFinite(originalGrams) || originalGrams <= 0)) {
    throw new Error("AI did not provide a serving weight. Check grams before filling the form.");
  }
  const factor = targetGrams !== null ? targetGrams / originalGrams : 1;
  if (!Number.isFinite(factor) || factor <= 0 || factor > 10) {
    throw new Error("AI serving size does not match your portion. Verify the grams first.");
  }
  const draft: Partial<Record<BarcodeTextAiField, string>> = {};
  for (const key of BARCODE_TEXT_AI_FIELDS) {
    if (known(current[key])) continue;
    if ((key === "protein" || key === "carbs" || key === "fat") && food.unknownMacros?.includes(key)) continue;
    const value = food[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    draft[key] = String(Math.round(value * factor * 100) / 100);
  }
  return draft;
}
