import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, fromMock, indexMock, detailMock, redirectMock, createClientMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const fromMock = vi.fn();
  const indexMock = vi.fn();
  const detailMock = vi.fn();
  const redirectMock = vi.fn(() => { throw new Error("redirect"); });
  const createClientMock = vi.fn(async () => ({ auth: { getUser: getUserMock }, from: fromMock }));
  return { getUserMock, fromMock, indexMock, detailMock, redirectMock, createClientMock };
});

vi.mock("../../lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import MealsPage from "./page";

const emptyParams = { searchParams: Promise.resolve({}) };
const meal = {
  id: "meal-123",
  created_at: "2026-10-08T11:00:00Z",
  consumed_at: "2026-10-08T11:00:00Z",
  total_calories: 580,
  total_protein: 42,
  total_carbs: 61,
  total_fat: 17,
  notes: "Estimated from photo",
  meal_items: [{ id: "item-123", name: "Chicken rice", estimated_grams: 300, calories: 500 }],
};

function setupQueryMocks() {
  fromMock.mockImplementation(() => ({
    select: () => {
      const query = {
        eq: () => query,
        order: () => query,
        gte: () => query,
        lt: () => query,
        ilike: () => query,
        range: (start: number, end: number) => indexMock(start, end),
        in: (_key: string, ids: string[]) => detailMock(ids),
      };
      return query;
    },
  }));
}

describe("Meal History page (Phase Z1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    indexMock.mockResolvedValue({ data: [], error: null });
    detailMock.mockResolvedValue({ data: [], error: null });
    setupQueryMocks();
  });

  it("redirects guests before reading meals", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    await expect(MealsPage(emptyParams)).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("/auth/login"));
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("shows an empty history state", async () => {
    const html = renderToStaticMarkup(await MealsPage(emptyParams));
    expect(html).toContain("No meals found for these filters");
    expect(fromMock).toHaveBeenCalledWith("meals");
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("shows matching meals, calories, macros and meal details", async () => {
    indexMock.mockResolvedValue({ data: [meal], error: null });
    detailMock.mockResolvedValue({ data: [meal], error: null });
    const html = renderToStaticMarkup(await MealsPage(emptyParams));
    expect(html).toContain("580 kcal");
    expect(html).toContain("Chicken rice");
    expect(html).toContain("Protein");
    expect(html).toContain("42");
    expect(detailMock).toHaveBeenCalledWith(["meal-123"]);
  });

  it("keeps fractional macros", async () => {
    const decimal = { ...meal, total_fat: 11.5 };
    indexMock.mockResolvedValue({ data: [decimal], error: null });
    detailMock.mockResolvedValue({ data: [decimal], error: null });
    const html = renderToStaticMarkup(await MealsPage(emptyParams));
    expect(html).toContain("11.5 g");
  });

  it("shows a database error rather than claiming no meals", async () => {
    indexMock.mockResolvedValue({ data: null, error: { message: "Database unavailable" } });
    const html = renderToStaticMarkup(await MealsPage(emptyParams));
    expect(html).toContain("Could not load your meals");
    expect(html).not.toContain("No meals found for these filters");
  });

  it("keeps Meal History in the sidebar instead of the account menu", () => {
    const menu = readFileSync(new URL("../../components/account-menu.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../../components/app-shell.tsx", import.meta.url), "utf8");
    expect(menu).not.toContain('href="/meals"');
    expect(shell).toContain('href: "/meals"');
  });
});
