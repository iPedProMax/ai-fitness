import type { FoodAnalysis } from "@/lib/food-analysis";

/** For Groq/Cloudflare only: a visible number is not proof the bowl was tared. */
export function ensureFreeProviderScaleClarifications(analysis: FoodAnalysis): FoodAnalysis {
  // Only the user's tare confirmation can set SCALE_MEASURED. A vision model's
  // assertion alone is not evidence; downgrade it before constructing questions.
  const foods = analysis.foods.map(food => food.weightSource === "SCALE_MEASURED"
    ? { ...food, weightSource: "AI_ESTIMATE" as const } : food);
  const changed = foods.some((food, index) => food !== analysis.foods[index]);
  const safeAnalysis = changed ? { ...analysis, foods } : analysis;
  const additional: FoodAnalysis["clarifications"] = [];
  safeAnalysis.foods.forEach((food, foodIndex) => {
    const grams = food.scaleReadingGrams;
    if (grams === undefined || !Number.isFinite(grams) || grams <= 0 || grams > 10000 ||
      safeAnalysis.clarifications.some(item => item.foodIndex === foodIndex && item.id === `tare_status_${foodIndex}`)) {
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
  return additional.length
    ? { ...safeAnalysis, clarifications: [...safeAnalysis.clarifications, ...additional] }
    : safeAnalysis;
}
