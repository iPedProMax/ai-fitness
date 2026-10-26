import type { FoodAnalysis } from "@/lib/food-analysis";

/** For Groq/Cloudflare only: a visible number is not proof the bowl was tared. */
export function ensureFreeProviderScaleClarifications(analysis: FoodAnalysis): FoodAnalysis {
  const additional: FoodAnalysis["clarifications"] = [];
  analysis.foods.forEach((food, foodIndex) => {
    const grams = food.scaleReadingGrams;
    if (grams === undefined || !Number.isFinite(grams) || grams <= 0 || grams > 10000 ||
      food.weightSource === "SCALE_MEASURED" ||
      analysis.clarifications.some(item => item.foodIndex === foodIndex && item.id === `tare_status_${foodIndex}`)) {
      return;
    }
    additional.push({
      id: `tare_status_${foodIndex}`,
      foodIndex,
      question: `The scale reads ${grams} g. Was the container tared before weighing?`,
      options: ["Yes", "No", "Not sure"],
      allowCustomAnswer: false,
    });
  });
  return additional.length ? { ...analysis, clarifications: [...analysis.clarifications, ...additional] } : analysis;
}
