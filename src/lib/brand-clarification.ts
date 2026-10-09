import type { FoodAnalysis } from "./food-analysis";

export const UNKNOWN_BRAND_ANSWER = "I don't know";

export function isUnknownBrandAnswer(
  clarificationId: string,
  answer: string
): boolean {
  return (
    /^brand_\d+$/.test(clarificationId) &&
    answer.trim().toLowerCase() ===
      UNKNOWN_BRAND_ANSWER.toLowerCase()
  );
}

export function skipBrandClarification(
  analysis: FoodAnalysis,
  clarificationId: string
): FoodAnalysis {
  return {
    ...analysis,
    clarifications:
      analysis.clarifications.filter(
        (clarification) =>
          clarification.id !== clarificationId
      ),
  };
}
