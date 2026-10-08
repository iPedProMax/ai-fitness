import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  getUserMock,
  fromMock,
  selectMock,
  orderMock,
  redirectMock,
  createClientMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const orderMock = vi.fn();

  const selectMock = vi.fn(() => ({
    order: orderMock,
  }));

  const fromMock = vi.fn(() => ({
    select: selectMock,
  }));

  const createClientMock = vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  }));

  const redirectMock = vi.fn(() => {
    throw new Error("redirect");
  });

  return {
    getUserMock,
    fromMock,
    selectMock,
    orderMock,
    redirectMock,
    createClientMock,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import MealsPage from "./page";

describe("Meal History page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-123" },
      },
      error: null,
    });

    orderMock.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("redirects guests before reading meals", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(MealsPage()).rejects.toThrow(
      "redirect"
    );

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login")
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("shows an empty history message", async () => {
    const html = renderToStaticMarkup(
      await MealsPage()
    );

    expect(html).toContain("No meals saved yet");
    expect(fromMock).toHaveBeenCalledWith("meals");

    expect(orderMock).toHaveBeenCalledWith(
      "created_at",
      { ascending: false }
    );
  });

  it("displays saved meals and nutrition details", async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: "meal-123",
          created_at: "2026-10-08T11:00:00Z",
          total_calories: 580,
          total_protein: 42,
          total_carbs: 61,
          total_fat: 17,
          notes: "Estimated from photo",
          meal_items: [
            {
              id: "item-123",
              name: "Chicken rice",
              estimated_grams: 300,
              calories: 500,
            },
          ],
        },
      ],
      error: null,
    });

    const html = renderToStaticMarkup(
      await MealsPage()
    );

    expect(html).toContain("580 kcal");
    expect(html).toContain("Chicken rice");
    expect(html).toContain("Protein");
    expect(html).toContain("42");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("meal_items")
    );
  });

  it("shows database errors instead of an empty state", async () => {
    orderMock.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });

    const html = renderToStaticMarkup(
      await MealsPage()
    );

    expect(html).toContain("Could not load your meals");
    expect(html).not.toContain("No meals saved yet");
  });

  it("includes Meal History in the account menu", () => {
    const menu = readFileSync(
      new URL(
        "../../components/account-menu.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(menu).toContain('href="/meals"');
  });
});
