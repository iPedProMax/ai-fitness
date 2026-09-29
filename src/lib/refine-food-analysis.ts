import {
  foodAnalysisSchema,
  type FoodAnalysis,
} from "./food-analysis";

export async function refineFoodAnalysis(
  analysis: FoodAnalysis,
  clarificationId: string,
  answer: string
): Promise<FoodAnalysis> {
  const response = await fetch("/api/food/refine", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      analysis,
      clarificationId,
      answer,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Failed to refine food analysis."
    );
  }

  return foodAnalysisSchema.parse(data);
}