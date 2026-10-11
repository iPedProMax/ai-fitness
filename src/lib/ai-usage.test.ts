import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, rpcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(), rpcMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getAiUsage, reserveAiUsage } from "./ai-usage";

const resetsAt = "2026-10-11T16:00:00+00:00";

describe("Supabase-backed AI allowance", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createClientMock.mockReset();
    createClientMock.mockResolvedValue({ rpc: rpcMock });
  });

  it("charges one atomic photo/text analysis via authenticated Supabase RPC", async () => {
    rpcMock.mockResolvedValue({ data: {
      allowed: true, kind: "analysis", limit: 20, used: 1,
      remaining: 19, resetsAt,
    }, error: null });
    expect(await reserveAiUsage("analysis")).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("reserve_ai_usage", { p_kind: "analysis" });
  });

  it("returns 429 without allowing Gemini after the twentieth use", async () => {
    rpcMock.mockResolvedValue({ data: {
      allowed: false, kind: "analysis", limit: 20, used: 20,
      remaining: 0, resetsAt,
    }, error: null });
    const response = await reserveAiUsage("analysis");
    expect(response?.status).toBe(429);
    expect((await response?.json()).code).toBe("AI_QUOTA_EXCEEDED");
  });

  it("keeps clarification use separate from new analyses", async () => {
    rpcMock.mockResolvedValue({ data: {
      allowed: true, kind: "refinement", limit: 60, used: 1,
      remaining: 59, resetsAt,
    }, error: null });
    expect(await reserveAiUsage("refinement")).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("reserve_ai_usage", { p_kind: "refinement" });
  });

  it("fails closed on database errors instead of allowing free Gemini calls", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await reserveAiUsage("analysis"))?.status).toBe(503);
  });

  it("fails closed on malformed RPC responses", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: true }, error: null });
    expect((await reserveAiUsage("analysis"))?.status).toBe(503);
  });

  it("returns current usage without incrementing it", async () => {
    rpcMock.mockResolvedValue({ data: {
      limit: 20, used: 3, remaining: 17,
      refinementLimit: 60, refinementsUsed: 2, resetsAt,
    }, error: null });
    const response = await getAiUsage();
    expect(response.status).toBe(200);
    expect((await response.json()).remaining).toBe(17);
    expect(rpcMock).toHaveBeenCalledWith("get_ai_usage");
  });
});