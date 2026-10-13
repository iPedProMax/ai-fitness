import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, fromMock, limitMock, preferenceMock, redirectMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const limitMock = vi.fn();
  const preferenceMock = vi.fn();
  const fromMock = vi.fn((table: string) => table === "user_preferences" ? ({
    select: () => ({ eq: () => ({ maybeSingle: preferenceMock }) }),
  }) : ({
    select: () => ({ eq: () => ({ order: () => ({ limit: limitMock }) }) }),
  }));
  const redirectMock = vi.fn(() => { throw new Error("redirect"); });
  return { getUserMock, fromMock, limitMock, preferenceMock, redirectMock };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/components/activity-form", () => ({ ActivityForm: () => <div>Activity form</div> }));
vi.mock("@/components/delete-activity-button", () => ({ DeleteActivityButton: () => <button>Delete</button> }));

import ActivitiesPage from "./page";

describe("Activities page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    limitMock.mockResolvedValue({ data: [], error: null });
    preferenceMock.mockResolvedValue({ data: null, error: null });
  });
  it("redirects guests before accessing activity records", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    await expect(ActivitiesPage()).rejects.toThrow("redirect");
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("shows empty activity history", async () => {
    const html = renderToStaticMarkup(await ActivitiesPage());
    expect(html).toContain("No activities saved yet");
    expect(html).toContain("Manual logging");
    expect(fromMock).toHaveBeenCalledWith("activities");
  });
  it("hides calories by default but keeps exercise history", async () => {
    limitMock.mockResolvedValue({ data: [{
      id: "123e4567-e89b-42d3-a456-426614174000", activity_type: "walking",
      intensity: "moderate", duration_minutes: 60, calories_burned: 294,
      calorie_source: "estimated", performed_at: "2026-10-12T12:00:00Z", notes: "Treadmill",
    }], error: null });
    const html = renderToStaticMarkup(await ActivitiesPage());
    expect(html).toContain("Walking");
    expect(html).toContain("Treadmill");
    expect(html).not.toContain("294 kcal");
  });
  it("shows an exercise and its recorded calories when enabled", async () => {
    preferenceMock.mockResolvedValue({ data: { show_exercise_calories: true }, error: null });
    limitMock.mockResolvedValue({ data: [{
      id: "123e4567-e89b-42d3-a456-426614174000", activity_type: "walking",
      intensity: "moderate", duration_minutes: 60, calories_burned: 294,
      calorie_source: "estimated", performed_at: "2026-10-12T12:00:00Z", notes: "Treadmill",
    }], error: null });
    const html = renderToStaticMarkup(await ActivitiesPage());
    expect(html).toContain("Walking");
    expect(html).toContain("294 kcal");
    expect(html).toContain("Treadmill");
  });
  it("shows a database error rather than pretending the history is empty", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "missing table" } });
    const html = renderToStaticMarkup(await ActivitiesPage());
    expect(html).toContain("Could not load your activities");
    expect(html).not.toContain("No activities saved yet");
  });
});
