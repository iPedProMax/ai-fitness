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
  it("cannot reserve credits outside a durable HTTP request context",async()=>{
    rpcMock.mockResolvedValue({data:{allowed:true,kind:"analysis",limit:20,used:1,remaining:19,resetsAt},error:null});
    expect((await reserveAiUsage("analysis"))?.status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refinement also requires durable context rather than the legacy reservation RPC", async () => {
    expect((await reserveAiUsage("refinement"))?.status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("reports exhausted analysis status without charging", async () => {
    rpcMock.mockResolvedValue({ data: {
      limit: 20, used: 20, remaining: 0, refinementLimit:60, refinementsUsed:0, resetsAt,
    }, error: null });
    const response = await getAiUsage();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({used:20,remaining:0,refinementsUsed:0});
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("get_ai_usage");
  });

  it("keeps clarification use separate from new analyses", async () => {
    rpcMock.mockResolvedValue({ data: {
      limit:20,used:1,remaining:19,refinementLimit:60,refinementsUsed:60,resetsAt,
    }, error: null });
    expect(await (await getAiUsage()).json()).toMatchObject({used:1,refinementsUsed:60,refinementLimit:60});
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("get_ai_usage");
  });

  it("fails closed on database errors instead of allowing free Gemini calls", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await getAiUsage()).status).toBe(503);
  });

  it("fails closed on malformed RPC responses", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: true }, error: null });
    expect((await getAiUsage()).status).toBe(503);
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
