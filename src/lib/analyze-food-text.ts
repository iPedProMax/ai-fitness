import { submitAiRequest, foodApiError, type AiSubmissionOptions } from "./ai-submission";
import { foodAnalysisSchema, type FoodAnalysis } from "./food-analysis";

export async function analyzeFoodText(description: string, options?: AiSubmissionOptions): Promise<FoodAnalysis> {
  const trimmed = description.trim();
  if (trimmed.length < 3 || trimmed.length > 600) {
    throw new Error("Describe your food in 3 to 600 characters.");
  }
  const response = await submitAiRequest("/api/food/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: trimmed, model: options?.modelId }),
  }, options);
  const data = await response.json();
  if (!response.ok) {
    throw foodApiError(data, "Could not estimate this food.");
  }
  return foodAnalysisSchema.parse(data);
}
