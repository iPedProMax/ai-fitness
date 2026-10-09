import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  getUserMock,
  insertMealMock,
  insertItemsMock,
  fromMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();

  const insertMealMock = vi.fn(
    (_record: Record<string, unknown>) => ({
      select: () => ({
        single: async () => ({
          data: { id: "meal-123" },
          error: null,
        }),
      }),
    })
  );

  const insertItemsMock = vi.fn(
    async (_items: unknown[]) => ({
      error: null,
    })
  );

  const fromMock = vi.fn((table: string) => {
    if (table === "meals") {
      return {
        insert: insertMealMock,
      };
    }

    if (table === "meal_items") {
      return {
        insert: insertItemsMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    getUserMock,
    insertMealMock,
    insertItemsMock,
    fromMock,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  }),
}));

import { saveMeal } from "./actions";
import { normalizeConsumedAt } from "../../lib/meal-time";

const validAnalysis = {
  foods: [
    {
      name: "Cooked rice",
      estimatedGrams: 200,
      calories: 260,
      protein: 5.4,
      carbs: 57.2,
      fat: 0.6,
      confidence: 0.85,
    },
  ],
  totalCalories: 260,
  notes: "Estimated from photo.",
  clarifications: [],
};

describe("meal eating timestamps", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-123" },
      },
      error: null,
    });
  });

  it("saves a meal with an earlier eating time", async () => {
    const yesterday = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const result = await saveMeal(
      validAnalysis,
      yesterday
    );

    expect(result).toEqual({
      ok: true,
      mealId: "meal-123",
    });

    expect(insertMealMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        consumed_at: yesterday,
        total_calories: 260,
      })
    );
  });

  it("keeps the database default for normal saves", async () => {
    const result = await saveMeal(validAnalysis);

    expect(result.ok).toBe(true);

    const record =
      insertMealMock.mock.calls[0][0];

    expect(record).not.toHaveProperty(
      "consumed_at"
    );
  });

  it("rejects future eating times", async () => {
    const future = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const result = await saveMeal(
      validAnalysis,
      future
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_MEAL_TIME",
    });

    expect(insertMealMock).not.toHaveBeenCalled();
  });

  it("rejects malformed eating timestamps", async () => {
    const result = await saveMeal(
      validAnalysis,
      "2026-02-30T10:00:00.000Z"
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_MEAL_TIME",
    });

    expect(insertMealMock).not.toHaveBeenCalled();
  });

  it("supports local time converted to UTC ISO", () => {
    const localMealTime = new Date(
      2026, 0, 15, 19, 30
    );

    expect(
      normalizeConsumedAt(
        localMealTime.toISOString(),
        new Date(2026, 0, 16, 12)
      )
    ).toBe(localMealTime.toISOString());
  });
});