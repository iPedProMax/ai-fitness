import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  createClientMock,
  getUserMock,
  fromMock,
  mealInsertMock,
  mealSelectMock,
  mealSingleMock,
  mealItemsInsertMock,
  mealDeleteMock,
  mealDeleteIdEqMock,
  mealDeleteUserEqMock,
} = vi.hoisted(() => {
  const mealSingleMock = vi.fn();

  const mealSelectMock = vi.fn(() => ({
    single: mealSingleMock,
  }));

  const mealInsertMock = vi.fn(() => ({
    select: mealSelectMock,
  }));

  const mealItemsInsertMock = vi.fn();

  const mealDeleteUserEqMock = vi.fn();

  const mealDeleteIdEqMock = vi.fn(() => ({
    eq: mealDeleteUserEqMock,
  }));

  const mealDeleteMock = vi.fn(() => ({
    eq: mealDeleteIdEqMock,
  }));

  const fromMock = vi.fn((table: string) => {
    if (table === "meals") {
      return {
        insert: mealInsertMock,
        delete: mealDeleteMock,
      };
    }

    if (table === "meal_items") {
      return {
        insert: mealItemsInsertMock,
      };
    }

    throw new Error(
      `Unexpected table: ${table}`
    );
  });

  const getUserMock = vi.fn();

  const createClientMock = vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  }));

  return {
    createClientMock,
    getUserMock,
    fromMock,
    mealInsertMock,
    mealSelectMock,
    mealSingleMock,
    mealItemsInsertMock,
    mealDeleteMock,
    mealDeleteIdEqMock,
    mealDeleteUserEqMock,
  };
});

vi.mock(
  "../../lib/supabase/server",
  () => ({
    createClient: createClientMock,
  })
);

import {
  saveMeal,
} from "./actions";

const validAnalysis = {
  foods: [
    {
      name: "Chicken rice",
      estimatedGrams: 300,
      calories: 500,
      protein: 35,
      carbs: 60,
      fat: 12,
      confidence: 0.9,
      weightSource: "AI_ESTIMATE",
      nutritionSource: "AI_ESTIMATE",
    },
    {
      name: "Boiled egg",
      estimatedGrams: 50,
      calories: 80,
      protein: 7,
      carbs: 1,
      fat: 5,
      confidence: 0.95,
      weightSource: "AI_ESTIMATE",
      nutritionSource: "AI_ESTIMATE",
    },
  ],
  totalCalories: 580,
  notes: "Estimated from food photo.",
  clarifications: [],
};

describe("saveMeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mealSingleMock.mockResolvedValue({
      data: {
        id: "meal-123",
      },
      error: null,
    });

    mealItemsInsertMock.mockResolvedValue({
      error: null,
    });

    mealDeleteUserEqMock.mockResolvedValue({
      error: null,
    });
  });

  it("rejects unauthenticated users without writing", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    const result =
      await saveMeal(validAnalysis);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message:
        "You need to sign in before saving a meal.",
    });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects invalid analysis without writing", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
      error: null,
    });

    const result =
      await saveMeal({
        totalCalories: -10,
      });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe(
        "INVALID_ANALYSIS"
      );
    }

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("saves the meal and its food items for the authenticated user", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
      error: null,
    });

    const result =
      await saveMeal(validAnalysis);

    expect(result).toEqual({
      ok: true,
      mealId: "meal-123",
    });

    expect(mealInsertMock).toHaveBeenCalledWith({
      user_id: "user-123",
      total_calories: 580,
      total_protein: 42,
      total_carbs: 61,
      total_fat: 17,
      notes:
        "Estimated from food photo.",
      analysis_snapshot:
        validAnalysis,
    });

    expect(mealSelectMock).toHaveBeenCalledWith(
      "id"
    );

    expect(
      mealItemsInsertMock
    ).toHaveBeenCalledWith([
      {
        meal_id: "meal-123",
        user_id: "user-123",
        name: "Chicken rice",
        estimated_grams: 300,
        calories: 500,
        protein: 35,
        carbs: 60,
        fat: 12,
        confidence: 0.9,
        weight_source:
          "AI_ESTIMATE",
        nutrition_source:
          "AI_ESTIMATE",
      },
      {
        meal_id: "meal-123",
        user_id: "user-123",
        name: "Boiled egg",
        estimated_grams: 50,
        calories: 80,
        protein: 7,
        carbs: 1,
        fat: 5,
        confidence: 0.95,
        weight_source:
          "AI_ESTIMATE",
        nutrition_source:
          "AI_ESTIMATE",
      },
    ]);
  });

  it("removes the parent meal when saving food items fails", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
      error: null,
    });

    mealItemsInsertMock.mockResolvedValue({
      error: {
        message:
          "Meal item insert failed",
      },
    });

    const result =
      await saveMeal(validAnalysis);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe(
        "SAVE_FAILED"
      );
    }

    expect(
      mealDeleteMock
    ).toHaveBeenCalled();

    expect(
      mealDeleteIdEqMock
    ).toHaveBeenCalledWith(
      "id",
      "meal-123"
    );

    expect(
      mealDeleteUserEqMock
    ).toHaveBeenCalledWith(
      "user_id",
      "user-123"
    );
  });
});
