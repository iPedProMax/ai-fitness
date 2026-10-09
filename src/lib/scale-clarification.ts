import type { FoodAnalysis } from "./food-analysis";

export function normalizeScaleClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  const foods = analysis.foods.map((food) => ({
    ...food,
  }));

  const clarifications = analysis.clarifications.flatMap(
    (clarification) => {
      if (!clarification.id.startsWith("tare_status_")) {
        return [clarification];
      }

      const food = foods[clarification.foodIndex];

      if (!food) {
        return [];
      }

      let reading = food.scaleReadingGrams;

      if (reading == null) {
        const match = clarification.question.match(
          /\bscale\s+(?:reads?|shows?|displays?)\s+(\d+(?:\.\d+)?)\s*(?:g|grams)\b/i
        );

        if (match) {
          reading = Number(match[1]);
        }
      }

      if (
        reading == null ||
        !Number.isFinite(reading) ||
        reading <= 0
      ) {
        // Never offer a tare button without
        // the measurement needed to process it.
        return [];
      }

      foods[clarification.foodIndex] = {
        ...food,
        scaleReadingGrams: reading,
      };

      return [
        {
          ...clarification,
          question:
            `The scale reads ${reading} g. ` +
            "Was the container tared before weighing?",
          options: ["Yes", "No", "Not sure"],
          allowCustomAnswer: false,
        },
      ];
    }
  );

  return {
    ...analysis,
    foods,
    clarifications,
  };
}