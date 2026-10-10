import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { requireFoodApiAuth } from "./food-api-auth";

describe("Gemini API authentication guard", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockImplementation(async () => ({
      auth: { getUser: getUserMock },
    }));
  });

  it("allows a verified signed-in user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "example-user" } },
      error: null,
    });
    expect(await requireFoodApiAuth()).toBeNull();
  });

  it("rejects unauthenticated requests with HTTP 401", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await requireFoodApiAuth();
    expect(response?.status).toBe(401);
  });

  it("rejects failed token verification with HTTP 401", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null }, error: { message: "invalid token" },
    });
    const response = await requireFoodApiAuth();
    expect(response?.status).toBe(401);
  });

  it("fails closed if the auth service throws", async () => {
    createClientMock.mockRejectedValue(new Error("Auth unavailable"));
    const response = await requireFoodApiAuth();
    expect(response?.status).toBe(503);
  });
});