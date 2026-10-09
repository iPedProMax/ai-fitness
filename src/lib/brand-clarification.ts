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

function isBrandQuestion(
  clarification: FoodAnalysis["clarifications"][number],
  foodIndex: number
): boolean {
  return (
    clarification.foodIndex === foodIndex &&
    (
      clarification.id === `brand_${foodIndex}` ||
      /\bbrand\b|\bexact product\b/i.test(
        clarification.question
      )
    )
  );
}

export function enforceBrandClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  const clarifications =
    analysis.clarifications.filter((clarification) => {
      const status =
        analysis.foods[clarification.foodIndex]
          ?.brandStatus;

      if (
        status === "KNOWN" ||
        status === "NOT_RELEVANT"
      ) {
        return !isBrandQuestion(
          clarification,
          clarification.foodIndex
        );
      }

      return true;
    });

  analysis.foods.forEach((food, foodIndex) => {
    const existingIndex =
      clarifications.findIndex((clarification) =>
        isBrandQuestion(clarification, foodIndex)
      );

    if (
      food.brandStatus !== "UNKNOWN_RELEVANT" &&
      existingIndex === -1
    ) {
      return;
    }

    const brandQuestion = {
      id: `brand_${foodIndex}`,
      foodIndex,
      question:
        `Do you know the brand or exact product of ${food.name}?`,
      options: ["I don't know"],
      allowCustomAnswer: true,
    };

    if (existingIndex >= 0) {
      clarifications[existingIndex] = brandQuestion;
      return;
    }

    clarifications.push(brandQuestion);
  });

  return {
    ...analysis,
    clarifications,
  };
}
