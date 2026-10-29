import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const {auth,generate,transport} = vi.hoisted(()=>({auth:vi.fn(),generate:vi.fn(),transport:vi.fn()}));
vi.mock("@/lib/food-api-auth",()=>({requireFoodApiAuth:auth}));
vi.mock("@/lib/ai/providers/ollama-local",()=>({
  OLLAMA_LOCAL_MODEL:"qwen2.5vl:3b",
  createOllamaLocalProvider:()=>({generate}),
}));
import { GET, POST } from "./route";
const url = "http://localhost:3000/api/coach/local";
const question = { model:"ollama-local",message:"Suggest a Filipino breakfast with protein",history:[] };
function request(body:unknown=question,origin="http://localhost:3000") {
  return new Request(url,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
}
beforeEach(()=>{
  vi.stubEnv("NODE_ENV","development");
  vi.stubEnv("AI_ENABLE_OLLAMA_LOCAL","true");
  auth.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({outputText:'{"reply":"Try eggs and rice with tomatoes."}'});
  transport.mockReset().mockResolvedValue(Response.json({models:[{name:"qwen2.5vl:3b"}]}));
  vi.stubGlobal("fetch",transport);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("AURA localhost-only Ollama dev integration",()=>{
  it("detects the installed model without calling generation",async()=>{
    const response=await GET(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({available:true,devOnly:true});
    expect(transport).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:11434/api/tags",expect.objectContaining({redirect:"error"}));
    expect(generate).not.toHaveBeenCalled();
  });
  it("shows unavailable if Ollama cannot be contacted",async()=>{
    transport.mockRejectedValue(new TypeError("offline"));
    const response=await GET(new Request(url));
    expect(await response.json()).toMatchObject({available:false});
  });
  it("fails closed in production even if flag is true",async()=>{
    vi.stubEnv("NODE_ENV","production");
    expect((await POST(request())).status).toBe(404);
    expect((await GET(new Request(url))).status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
  it("blocks remote hosts and cross-origin posts",async()=>{
    expect((await POST(new Request("http://192.168.1.4:3000/api/coach/local",{
      method:"POST",headers:{origin:"http://192.168.1.4:3000","content-type":"application/json"},body:JSON.stringify(question),
    }))).status).toBe(404);
    expect((await POST(request(question,"https://other.example"))).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });
  it("requires Supabase authentication before local requests",async()=>{
    auth.mockResolvedValue(Response.json({error:"Sign in"},{status:401}));
    expect((await POST(request())).status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects wrong provider and oversized questions before generation",async()=>{
    expect((await POST(request({...question,model:"openrouter"}))).status).toBe(400);
    expect((await POST(request({...question,message:"x".repeat(700)}))).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("generates structured coach reply without calling any cloud provider",async()=>{
    const response=await POST(request());
    expect(await response.json()).toMatchObject({reply:"Try eggs and rice with tomatoes.",model:"ollama-local",local:true});
    expect(generate).toHaveBeenCalledOnce();
    const call=generate.mock.calls[0][0];
    expect(call.input[0].text).toContain("AURA");
    expect(call.responseSchema.required).toContain("reply");
    expect(transport).not.toHaveBeenCalled();
  });
  it("sanitizes invalid model output",async()=>{
    generate.mockResolvedValue({outputText:"not json"});
    const response=await POST(request());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("not json");
  });
});