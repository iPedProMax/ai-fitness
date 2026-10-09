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
  updateMock,
  idEqMock,
  userEqMock,
  maybeSingleMock,
  revalidateMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const maybeSingleMock = vi.fn();

  const selectMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));

  const userEqMock = vi.fn(() => ({
    select: selectMock,
  }));

  const idEqMock = vi.fn(() => ({
    eq: userEqMock,
  }));

  const updateMock = vi.fn(() => ({
    eq: idEqMock,
  }));

  const fromMock = vi.fn(() => ({
    update: updateMock,
  }));

  const revalidateMock = vi.fn();

  return {
    getUserMock,
    fromMock,
    updateMock,
    idEqMock,
    userEqMock,
    maybeSingleMock,
    revalidateMock,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

import { updateMealConsumedAt } from "./update-time";

const mealId =
  "123e4567-e89b-42d3-a456-426614174000";

describe("edit meal eating time", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "owner-123" },
      },
      error: null,
    });

    maybeSingleMock.mockResolvedValue({
      data: { id: mealId },
      error: null,
    });
  });

  it("updates only the authenticated owner's meal", async () => {
    const consumedAt = new Date(
      Date.now() - 86400000
    ).toISOString();

    const result = await updateMealConsumedAt(
      mealId,
      consumedAt
    );

    expect(result).toEqual({ ok: true });

    expect(fromMock).toHaveBeenCalledWith("meals");

    expect(updateMock).toHaveBeenCalledWith({
      consumed_at: consumedAt,
    });

    expect(idEqMock).toHaveBeenCalledWith(
      "id",
      mealId
    );

    expect(userEqMock).toHaveBeenCalledWith(
      "user_id",
      "owner-123"
    );

    expect(revalidateMock).toHaveBeenCalledWith(
      "/meals"
    );

    expect(revalidateMock).toHaveBeenCalledWith(
      "/dashboard"
    );
  });

  it("does not update meals for guests", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await updateMealConsumedAt(
      mealId,
      new Date().toISOString()
    );

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects future eating times", async () => {
    const tomorrow = new Date(
      Date.now() + 86400000
    ).toISOString();

    const result = await updateMealConsumedAt(
      mealId,
      tomorrow
    );

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects malformed meal IDs", async () => {
    const result = await updateMealConsumedAt(
      "invalid-id",
      new Date().toISOString()
    );

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not claim success for inaccessible meals", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await updateMealConsumedAt(
      mealId,
      new Date().toISOString()
    );

    expect(result.ok).toBe(false);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("reports database update failures", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "Update failed" },
    });

    const result = await updateMealConsumedAt(
      mealId,
      new Date().toISOString()
    );

    expect(result.ok).toBe(false);
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});