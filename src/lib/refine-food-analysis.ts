import { submitAiRequest, foodApiError, type AiSubmissionOptions } from "./ai-submission";
import {
  foodAnalysisSchema,
  type FoodAnalysis,
} from "./food-analysis";

export async function refineFoodAnalysis(
  analysis: FoodAnalysis,
  clarificationId: string,
  answer: string,
  options?: AiSubmissionOptions
): Promise<FoodAnalysis> {
  const response = await submitAiRequest("/api/food/refine", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      analysis,
      clarificationId,
      answer,
      model: options?.modelId,
    }),
  }, options);

  const data = await response.json();

  if (!response.ok) {
    throw foodApiError(data, "Failed to refine food analysis.");
  }

  return foodAnalysisSchema.parse(data);
}
