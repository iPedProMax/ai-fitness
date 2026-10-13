import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, preferenceMock, fromMock, redirectMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const preferenceMock = vi.fn();
  const fromMock = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: preferenceMock }) }),
  }));
  const redirectMock = vi.fn(() => { throw new Error("redirect"); });
  return { getUserMock, preferenceMock, fromMock, redirectMock };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/components/exercise-display-settings", () => ({
  ExerciseDisplaySettings: ({ initialShowExerciseCalories }: { initialShowExerciseCalories: boolean }) => (
    <div>Exercise settings {String(initialShowExerciseCalories)}</div>
  ),
}));
import SettingsPage from "./page";

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
    preferenceMock.mockResolvedValue({ data: null, error: null });
  });
  it("doesn't query user settings for guests", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    await expect(SettingsPage()).rejects.toThrow("redirect");
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("defaults to hiding exercise calories when no preference has been saved", async () => {
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("Exercise settings false");
    expect(fromMock).toHaveBeenCalledWith("user_preferences");
  });
  it("loads a saved preference", async () => {
    preferenceMock.mockResolvedValue({ data: { show_exercise_calories: true }, error: null });
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("Exercise settings true");
  });
  it("shows database errors without offering a broken toggle", async () => {
    preferenceMock.mockResolvedValue({ data: null, error: { message: "Missing table" } });
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("Could not load your preferences");
    expect(html).not.toContain("Exercise settings false");
  });
});
