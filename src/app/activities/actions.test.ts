import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, insertMock, deleteMock, eqMock, fromMock, createClientMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const insertMock = vi.fn();
  const eqMock = vi.fn();
  const deleteMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ insert: insertMock, delete: deleteMock }));
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock }, from: fromMock,
  }));
  return { getUserMock, insertMock, deleteMock, eqMock, fromMock, createClientMock };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { deleteActivity, saveActivity } from "./actions";

const valid = {
  activityType: "running", intensity: "moderate", durationMinutes: 30,
  weightKg: 80, reportedCalories: null, performedAt: "2026-10-12T12:00:00Z", notes: "Jogging",
};

describe("activity server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
    insertMock.mockResolvedValue({ error: null });
    eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: null });
  });
  it("never calls AI or debits the shared quota for manual activity logging", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    expect(source).not.toContain("reserveAiUsage");
    expect(source).not.toContain("@google/genai");
  });
  it("prevents anonymous saving and does not call the database", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await saveActivity(valid)).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("rejects invalid and future input without inserting", async () => {
    expect((await saveActivity({ ...valid, durationMinutes: -10 })).ok).toBe(false);
    expect((await saveActivity({ ...valid, performedAt: "2099-01-01T00:00:00Z" })).ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
  it("saves a user-owned workout with formula-based calories and no AI call", async () => {
    const result = await saveActivity(valid);
    expect(result).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("activities");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "owner-1", activity_type: "running", intensity: "moderate",
      duration_minutes: 30, calorie_source: "estimated", notes: "Jogging",
    }));
  });
  it("uses manually reported calories if provided", async () => {
    await saveActivity({ ...valid, reportedCalories: 412 });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      calories_burned: 412, calorie_source: "reported",
    }));
  });
  it("returns an error if Supabase cannot insert", async () => {
    insertMock.mockResolvedValue({ error: { message: "table missing" } });
    expect((await saveActivity(valid)).ok).toBe(false);
  });
  it("rejects anonymous deletion and malformed IDs", async () => {
    expect((await deleteActivity("bad-id")).ok).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await deleteActivity("123e4567-e89b-42d3-a456-426614174000")).ok).toBe(false);
  });
  it("restricts deletes by user ID as well as activity ID", async () => {
    await deleteActivity("123e4567-e89b-42d3-a456-426614174000");
    expect(eqMock).toHaveBeenCalledWith("id", "123e4567-e89b-42d3-a456-426614174000");
    expect(eqMock).toHaveBeenCalledWith("user_id", "owner-1");
  });
});
