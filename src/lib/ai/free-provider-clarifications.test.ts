import { describe, expect, it } from "vitest";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { pruneFreeProviderClarifications } from "./free-provider-clarifications";

const drink = (overrides: Partial<FoodAnalysis["foods"][number]> = {}): FoodAnalysis => ({
  foods: [{
    name: "NESTEA Cleanse Lemon Green Tea Drink",
    estimatedGrams: 250,
    calories: 52,
    protein: 0,
    carbs: 7.9,
    fat: 0,
    confidence: 0.8,
    preparationState: "OPEN_PREPARED",
    nutritionSource: "NUTRITION_LABEL",
    ...overrides,
  }],
  totalCalories: 52,
  notes: "Label-backed",
  clarifications: [],
});

const question = (id: string, text: string) => ({
  id, foodIndex: 0, question: text, options: ["I don't know"], allowCustomAnswer: true,
});

describe("free-provider clarification cleanup", () => {
  it("removes redundant variety prompts on labelled drinks but keeps apple amount", () => {
    const data = drink();
    data.clarifications = [
      question("variety_0", "Do you know the type or variety of NESTEA green tea drink?"),
      question("material_uncertainty_0", "How many apple pieces were added?"),
    ];
    const result = pruneFreeProviderClarifications(data);
    expect(result.clarifications.map((x) => x.id)).toEqual(["material_uncertainty_0"]);
    expect(result.foods[0].calories).toBe(52);
    expect(data.clarifications).toHaveLength(2); // immutable
  });

  it("removes the irrelevant powder versus plain-water question", () => {
    const data = drink();
    data.clarifications = [
      question("prep_0", "Are you consuming just the powder from one sachet, or the entire prepared drink (powder mixed with water)?"),
      question("sachets_0", "How many sachets did you use?"),
    ];
    expect(pruneFreeProviderClarifications(data).clarifications.map((x) => x.id))
      .toEqual(["sachets_0"]);
  });

  it("does not ask about additions already included in nutrition", () => {
    const data = drink({visibleAdditionsPresent: true, visibleAdditionsFullyAccountedFor: true});
    data.clarifications = [question("prepared_drink_additions_0", "Did you add anything else to this drink?")];
    expect(pruneFreeProviderClarifications(data).clarifications).toHaveLength(0);
  });

  it("keeps unaccounted additions and uncertain amounts", () => {
    const data = drink({visibleAdditionsPresent: true, visibleAdditionsFullyAccountedFor: false});
    data.clarifications = [
      question("prepared_drink_additions_0", "Did you add anything else to this drink?"),
      question("sachets_0", "How many sachets did you use?"),
    ];
    expect(pruneFreeProviderClarifications(data).clarifications).toHaveLength(2);
  });

  it("does not suppress rice-variety or unlabelled drink questions", () => {
    const food = drink({name:"Rice", preparationState:"NOT_APPLICABLE",nutritionSource:"AI_ESTIMATE"});
    food.clarifications = [question("variety_0", "Do you know the type or variety of Rice?")];
    expect(pruneFreeProviderClarifications(food)).toBe(food);
    const drinkWithoutLabel = drink({nutritionSource:"AI_ESTIMATE"});
    drinkWithoutLabel.clarifications = [question("variety_0", "Do you know the variety of tea?")];
    expect(pruneFreeProviderClarifications(drinkWithoutLabel)).toBe(drinkWithoutLabel);
  });
});
