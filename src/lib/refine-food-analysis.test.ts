import { afterEach, describe, expect, it, vi } from "vitest";

import { refineFoodAnalysis } from "./refine-food-analysis";
import type { FoodAnalysis } from "./food-analysis";

describe("refineFoodAnalysis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the clarification answer to the refinement API", async () => {
    const analysis: FoodAnalysis = {
      foods: [
        {
          name: "Pancit with mixed meat",
          estimatedGrams: 250,
          calories: 380,
          protein: 10,
          carbs: 55,
          fat: 13,
          confidence: 0.75,
        },
      ],
      totalCalories: 380,
      notes: "Meat type is uncertain.",
      clarifications: [
        {
          id: "meat_type",
          foodIndex: 0,
          question: "What type of meat is included?",
          options: ["Chicken", "Pork", "Beef"],
        },
      ],
    };

    const refinedResult: FoodAnalysis = {
      foods: [
        {
          name: "Chicken Pancit",
          estimatedGrams: 250,
          calories: 365,
          protein: 15,
          carbs: 55,
          fat: 10,
          confidence: 0.85,
        },
      ],
      totalCalories: 365,
      notes:
        "Chicken was confirmed by the user. Portion remains estimated.",
      clarifications: [],
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(refinedResult), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

    const result = await refineFoodAnalysis(
      analysis,
      "meat_type",
      "Chicken"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/food/refine",
      expect.objectContaining({
        method: "POST",
      })
    );

    const requestOptions = fetchMock.mock.calls[0][1];

    expect(
      JSON.parse(requestOptions?.body as string)
    ).toEqual({
      analysis,
      clarificationId: "meat_type",
      answer: "Chicken",
    });

    expect(result).toEqual(refinedResult);
  });
});