import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, client }=vi.hoisted(()=>({rpc:vi.fn(),client:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:client}));
import { controlRequest } from "./control-store";
const args={p_operation:"begin" as const,p_user_id:"00000000-0000-4000-8000-000000000001",p_key:"test-request-key-123",p_hash:"a".repeat(64),p_kind:"analysis" as const};
beforeEach(()=>{rpc.mockReset();client.mockReset().mockReturnValue({rpc});vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","synthetic-server-key");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("trusted accounting client",()=>{
  it("requires server credentials before constructing a client",async()=>{
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","");
    await expect(controlRequest(args)).rejects.toThrow("not configured");
    expect(client).not.toHaveBeenCalled();
  });
  it("only calls the control RPC with stateless auth and bounded transport",async()=>{
    rpc.mockResolvedValue({data:{ok:true},error:null});
    expect(await controlRequest(args)).toEqual({ok:true});
    expect(rpc).toHaveBeenCalledExactlyOnceWith("control_ai_request",args);
    expect(client.mock.calls[0][2].auth).toEqual({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
    const transport=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal("fetch",transport);
    await client.mock.calls[0][2].global.fetch("https://example.supabase.co/rest/v1/rpc/control_ai_request",{});
    expect(transport.mock.calls[0][1]).toMatchObject({redirect:"error",signal:expect.any(AbortSignal)});
  });
  it("sanitizes upstream failures and rejects malformed accounting responses",async()=>{
    rpc.mockResolvedValueOnce({data:null,error:{message:"SECRET"}});
    await expect(controlRequest(args)).rejects.toThrow("AI accounting unavailable");
    rpc.mockResolvedValueOnce({data:{claim:"invalid"},error:null});
    await expect(controlRequest(args)).rejects.toThrow();
  });
});
