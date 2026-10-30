import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const {auth,fetchMock,createClientMock,rpcMock,userMock}=vi.hoisted(()=>({
  auth:vi.fn(),fetchMock:vi.fn(),createClientMock:vi.fn(),rpcMock:vi.fn(),userMock:vi.fn()
}));
vi.mock("@/lib/food-api-auth",()=>({requireFoodApiAuth:auth}));
vi.mock("@/lib/supabase/server",()=>({createClient:createClientMock}));
import {GET} from "./route";
const url="http://localhost/api/food/catalog?barcode=3017624010701";
beforeEach(()=>{
  vi.stubEnv("NODE_ENV","test");
  auth.mockReset().mockResolvedValue(null);
  fetchMock.mockReset().mockResolvedValue(Response.json({status:1,product:{code:"3017624010701",product_name:"Spread",nutriments:{"energy-kcal_100g":500}}}));
  vi.stubGlobal("fetch",fetchMock);
  rpcMock.mockReset().mockResolvedValue({data:{allowed:true},error:null});
  userMock.mockReset().mockResolvedValue({data:{user:{id:"u1"}},error:null});
  createClientMock.mockReset().mockResolvedValue({auth:{getUser:userMock},rpc:rpcMock});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("food catalog access and fail-closed production rate limits",()=>{
  it("rejects invalid identifiers without an upstream call",async()=>{
    const r=await GET(new Request("http://localhost/api/food/catalog?barcode=abc%2F123"));
    expect(r.status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
  });
  it("blocks unauthenticated users before an upstream call",async()=>{
    auth.mockResolvedValue(Response.json({error:"Sign in"},{status:401}));
    expect((await GET(new Request(url))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("parses product and credits Open Food Facts",async()=>{
    const r=await GET(new Request(url));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({foods:[{name:"Spread",calories100g:500}],license:"ODbL"});
  });
  it("requires shared admission in production",async()=>{
    vi.stubEnv("NODE_ENV","production");
    const r=await GET(new Request(url));
    expect(r.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("admit_food_catalog_lookup",{p_kind:"barcode"});
  });
  it("fails closed if production migration is absent",async()=>{
    vi.stubEnv("NODE_ENV","production");rpcMock.mockResolvedValue({data:null,error:{message:"missing function"}});
    const r=await GET(new Request(url));expect(r.status).toBe(503);expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enforces production per-user/global gate",async()=>{
    vi.stubEnv("NODE_ENV","production");rpcMock.mockResolvedValue({data:{allowed:false,retry_after:32},error:null});
    const r=await GET(new Request(url));expect(r.status).toBe(429);expect(r.headers.get("Retry-After")).toBe("32");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns 429 without probing more models when upstream is limited",async()=>{
    fetchMock.mockResolvedValue(new Response("private details",{status:429}));
    const r=await GET(new Request(url));expect(r.status).toBe(429);
    expect(JSON.stringify(await r.json())).not.toContain("private details");
  });
});
