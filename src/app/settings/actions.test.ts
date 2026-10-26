import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, upsertMock, fromMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const upsertMock = vi.fn();
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  return { getUserMock, upsertMock, fromMock };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
import { saveExerciseDisplayPreference } from "./actions";

describe("Exercise display preference action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
    upsertMock.mockResolvedValue({ error: null });
  });
  it("rejects unauthenticated users", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await saveExerciseDisplayPreference(true)).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("rejects invalid input before touching the database", async () => {
    expect((await saveExerciseDisplayPreference("yes" as unknown as boolean)).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("saves the show preference only to the signed-in account", async () => {
    expect(await saveExerciseDisplayPreference(true)).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("user_preferences");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "account-1", show_exercise_calories: true,
    }), { onConflict: "user_id" });
  });
  it("can hide calories without touching activity records", async () => {
    expect(await saveExerciseDisplayPreference(false)).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      show_exercise_calories: false,
    }), { onConflict: "user_id" });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
  it("reports database failures", async () => {
    upsertMock.mockResolvedValue({ error: { message: "DB error" } });
    expect((await saveExerciseDisplayPreference(true)).ok).toBe(false);
  });
});
