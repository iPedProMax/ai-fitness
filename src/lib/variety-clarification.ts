import type { FoodAnalysis } from "./food-analysis";

export const UNKNOWN_VARIETY_ANSWER = "I don't know";

export function isUnknownVarietyAnswer(
  clarificationId: string,
  answer: string
): boolean {
  return (
    /^variety_\d+$/.test(clarificationId) &&
    answer.trim().toLowerCase() ===
      UNKNOWN_VARIETY_ANSWER.toLowerCase()
  );
}

export function skipVarietyClarification(
  analysis: FoodAnalysis,
  clarificationId: string
): FoodAnalysis {
  return {
    ...analysis,
    clarifications: analysis.clarifications.filter(
      (clarification) =>
        clarification.id !== clarificationId
    ),
  };
}

function getVarietyOptions(
  foodName: string
): string[] {
  const name = foodName.toLowerCase();

  if (
    /\b(rice|jasmine|basmati|dinorado|sinandomeng)\b/.test(
      name
    )
  ) {
    return [
      "Jasmine rice",
      "Basmati rice",
      "Brown rice",
      "Glutinous rice",
      "Dinorado / Sinandomeng",
      "I don't know",
    ];
  }

  if (/\b(oats|oatmeal|oat)\b/.test(name)) {
    return [
      "Rolled oats",
      "Instant oats",
      "Steel-cut oats",
      "I don't know",
    ];
  }

  return ["I don't know"];
}

export function enforceVarietyClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  // Replace generated variety questions with one
  // consistent question per relevant food.
  // Preserve brand, tare and other clarifications.
  const clarifications = analysis.clarifications.filter(
    (clarification) =>
      !/^variety_\d+$/.test(clarification.id)
  );

  analysis.foods.forEach((food, foodIndex) => {
    if (
      food.varietyStatus !==
      "UNKNOWN_RELEVANT"
    ) {
      return;
    }

    clarifications.push({
      id: `variety_${foodIndex}`,
      foodIndex,
      question:
        `Do you know the type or variety of ${food.name}?`,
      options: getVarietyOptions(food.name),
      allowCustomAnswer: true,
    });
  });

  return {
    ...analysis,
    clarifications,
  };
}