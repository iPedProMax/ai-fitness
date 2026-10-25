import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { ControlArguments, ControlResult } from "./control-store";
import type { AiProvider } from "./types";

const { control, getUser, sdk }=vi.hoisted(()=>({control:vi.fn(),getUser:vi.fn(),sdk:vi.fn()}));
vi.mock("./control-store",()=>({controlRequest:control}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser}})}));
vi.mock("@google/genai",()=>({GoogleGenAI:class{interactions={create:sdk};}}));
import { POST as text } from "@/app/api/food/text/route";
import { POST as photo } from "@/app/api/food/analyze/route";
import { POST as refine } from "@/app/api/food/refine/route";
import { reserveAiUsage } from "@/lib/ai-usage";
import { guardProvider, withAiRequest } from "./request-control";
import { generateWithFallback } from "./router";
import * as providerFactory from "./provider";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import { aiRoutingErrorResponse } from "./errors";

const db=new PGlite();
const user="00000000-0000-4000-8000-000000000001";
const food={foods:[{name:"Rice",estimatedGrams:100,calories:130,protein:3,carbs:28,fat:0,confidence:0.8}],totalCalories:130,notes:"",clarifications:[]};
function request(key: string=randomUUID(),description="100 g cooked rice") {
  return new Request("http://localhost/api/food/text",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({description})});
}
async function count(){return(await db.query<{used:number}>("select coalesce(sum(analyses_used),0)::int as used from public.ai_daily_usage")).rows[0].used;}
beforeAll(async()=>{
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';");
  await db.exec(readFileSync("supabase/migrations/20261011_create_ai_daily_usage.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20261015_ai_request_control.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20261023_distinct_free_gemini_models.sql","utf8"));
  await db.query("insert into auth.users values ($1)",[user]);
},30_000);
beforeEach(async()=>{
  await db.exec("truncate public.ai_requests,public.ai_daily_usage,public.ai_provider_usage cascade; update public.ai_runtime_policy set enabled=true; update public.ai_provider_policy set enabled=true,free_tier_verified=true,max_concurrent=1000,cooldown_until=null,requests_per_minute=1000,requests_per_day=1000,tokens_per_minute=10000000,tokens_per_day=10000000;");
  vi.stubEnv("AI_ENABLED","true"); vi.stubEnv("GEMINI_API_KEY","fake");
  getUser.mockReset().mockResolvedValue({data:{user:{id:user}},error:null});
  sdk.mockReset().mockResolvedValue({output_text:JSON.stringify(food)});
  control.mockReset().mockImplementation(async(args:ControlArguments):Promise<ControlResult>=>{
    const result=await db.query<{result:ControlResult}>("select public.control_ai_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
      [args.p_operation,args.p_user_id,args.p_key,args.p_hash??null,args.p_kind??null,args.p_claim??null,args.p_provider??null,args.p_tokens??null,args.p_status??null,args.p_body??null]);
    return result.rows[0].result;
  });
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
afterAll(async()=>db.close());

describe("HTTP → durable admission → guarded provider → final response replay",()=>{
  it("concurrent identical submissions spend one credit and make one model call",async()=>{
    const key=randomUUID();
    const responses=await Promise.all(Array.from({length:12},()=>text(request(key))));
    expect(responses.filter(response=>response.status===200)).toHaveLength(1);
    expect(responses.filter(response=>response.status===409)).toHaveLength(11);
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();
    const original=responses.find(response=>response.status===200)!;
    const replay=await text(request(key));
    expect(replay.status).toBe(200);expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(await replay.json()).toEqual(await original.json());
    expect(sdk).toHaveBeenCalledOnce();expect(await count()).toBe(1);
  });
  it("does not let the same key buy a different payload",async()=>{
    const key=randomUUID();await text(request(key));
    const response=await text(request(key,"200 g chicken"));
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"AI_KEY_CONFLICT"});
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();
  });
  it("uses image bytes rather than random multipart boundaries for photo replay",async()=>{
    const key=randomUUID();
    const make=()=>{const body=new FormData();body.append("images",new File(["same food bytes"],"meal.jpg",{type:"image/jpeg"}));return new Request("http://localhost/api/food/analyze",{method:"POST",headers:{"Idempotency-Key":key},body});};
    expect((await photo(make())).status).toBe(200);
    expect((await photo(make())).headers.get("Idempotency-Replayed")).toBe("true");
    expect(sdk).toHaveBeenCalledOnce();expect(await count()).toBe(1);
  });
  it("admits ten-photo analysis under a 100k shared token cap and reserves once across replay",async()=>{
    await db.exec("update public.ai_provider_policy set tokens_per_minute=100000,tokens_per_day=100000 where provider='gemini'");
    const key=randomUUID();
    const make=()=>{
      const body=new FormData();
      for(let i=0;i<10;i++)body.append("images",new File(["photo"],`${i}.jpg`,{type:"image/jpeg"}));
      return new Request("http://localhost/api/food/analyze",{method:"POST",headers:{"Idempotency-Key":key},body});
    };
    expect((await photo(make())).status).toBe(200);
    expect((await photo(make())).headers.get("Idempotency-Replayed")).toBe("true");
    const attempts=control.mock.calls.map(([args])=>args as ControlArguments).filter(args=>args.p_operation==="attempt");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].p_tokens).toBeGreaterThan(16_384+10*1_120);
    expect(attempts[0].p_tokens).toBeLessThan(100_000);
    const usage=(await db.query<{tokens:number}>("select tokens::int as tokens from public.ai_provider_usage where provider='gemini' and window_kind='day'")).rows[0];
    expect(usage.tokens).toBe(attempts[0].p_tokens);
    expect(sdk.mock.calls[0][0].generation_config).toEqual({max_output_tokens:16_384});
    expect(sdk.mock.calls[0][0].input.filter((part:{type:string})=>part.type==="image")).toEqual(Array.from({length:10},()=>expect.objectContaining({resolution:"high"})));
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();
  });
  it("still blocks a second request when the shared token allowance is exhausted",async()=>{
    await db.exec("update public.ai_provider_policy set tokens_per_minute=100000,tokens_per_day=100000 where provider='gemini'");
    expect((await text(request())).status).toBe(200);
    const reservation=(control.mock.calls.find(([args])=>args.p_operation==="attempt")![0] as ControlArguments).p_tokens!;
    await db.query("update public.ai_provider_policy set tokens_per_day=$1 where provider='gemini'",[reservation]);
    expect((await text(request())).status).toBe(503);
    expect(sdk).toHaveBeenCalledOnce();expect(await count()).toBe(1); // Pre-dispatch denial refunded.
  });
  it("rejects oversized refinement text without making a provider attempt",async()=>{
    const response=await refine(new Request("http://localhost/api/food/refine",{method:"POST",headers:{"Idempotency-Key":randomUUID()},body:JSON.stringify({
      analysis:{...food,notes:"x".repeat(200_000),clarifications:[{id:"oil",foodIndex:0,question:"Added oil?",options:["Yes","No"]}]},clarificationId:"oil",answer:"Yes",
    })}));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({code:"AI_INPUT_TOO_LARGE"});
    expect(control.mock.calls.some(([args])=>args.p_operation==="attempt")).toBe(false);
    expect(sdk).not.toHaveBeenCalled();
    expect((await db.query<{ used: number }>("select coalesce(sum(refinements_used),0)::int as used from public.ai_daily_usage")).rows[0].used).toBe(0);
  });
  it("replays AI refinement and preserves additive arithmetic and its separate allowance",async()=>{
    const key=randomUUID();
    const make=()=>new Request("http://localhost/api/food/refine",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify({analysis:{...food,clarifications:[{id:"oil",foodIndex:0,question:"Added oil?",options:["Yes","No"]}]},clarificationId:"oil",answer:"Yes"})});
    sdk.mockResolvedValue({output_text:JSON.stringify({updatedName:"Rice with oil",addedEstimatedGrams:5,addedCalories:45,addedProtein:0,addedCarbs:0,addedFat:5,confidence:0.8,notes:"Oil added",followUpClarifications:[]})});
    const first=await refine(make());expect(first.status).toBe(200);expect(await first.json()).toMatchObject({totalCalories:175});
    const replay=await refine(make());expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(sdk).toHaveBeenCalledOnce();expect(await count()).toBe(0);
    expect((await db.query<{used:number}>("select refinements_used as used from public.ai_daily_usage")).rows[0].used).toBe(1);
  });
  it("retains and replays failures without automatically charging again",async()=>{
    vi.spyOn(console,"error").mockImplementation(()=>undefined);
    sdk.mockRejectedValue({status:503});const key=randomUUID();
    expect((await text(request(key))).status).toBe(503);
    expect((await text(request(key))).headers.get("Idempotency-Replayed")).toBe("true");
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();
  });
  it("fails closed before the provider when admission or accounting is unavailable",async()=>{
    control.mockRejectedValue(new Error("database offline"));
    expect((await text(request())).status).toBe(503);expect(sdk).not.toHaveBeenCalled();
    expect(await count()).toBe(0);
  });
  it("fails closed on an attempt denial and refunds the credit before dispatch",async()=>{
    await db.exec("update public.ai_provider_policy set tokens_per_minute=1 where provider='gemini'");
    expect((await text(request())).status).toBe(503);expect(sdk).not.toHaveBeenCalled();
    expect(await count()).toBe(0);
  });
  it("does not return an unrecorded success if finalization fails",async()=>{
    const impl=control.getMockImplementation()!;
    control.mockImplementation((args:ControlArguments)=>args.p_operation==="finish"?Promise.reject(new Error("offline")):impl(args));
    const key=randomUUID();expect((await text(request(key))).status).toBe(503);
    expect((await text(request(key))).status).toBe(409);
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();
  });
  it("keeps manual scale clarification free even with AI disabled",async()=>{
    vi.stubEnv("AI_ENABLED","false");
    const response=await refine(new Request("http://localhost/api/food/refine",{method:"POST",body:JSON.stringify({
      analysis:{...food,foods:[{...food.foods[0],scaleReadingGrams:100}],clarifications:[{id:"tare_status_0",foodIndex:0,question:"Tared?",options:["Yes","No","Not sure"]}]},clarificationId:"tare_status_0",answer:"Yes",
    })}));
    expect(response.status).toBe(200);expect(control).not.toHaveBeenCalled();expect(sdk).not.toHaveBeenCalled();
  });
  it("blocks generation without a durable claim",async()=>{
    const generate=vi.fn();const provider:AiProvider={id:"gemini",enabled:true,available:true,capabilities:{text:true,vision:true,maxImages:10,structuredJson:true},generate};
    await expect(guardProvider(provider).generate({input:[],responseSchema:{}})).rejects.toMatchObject({code:"ACCOUNTING_UNAVAILABLE"});
    expect(generate).not.toHaveBeenCalled();
  });
  it("denies Cloudflare safely when the provider policy is missing",async()=>{
    const transport=vi.fn();vi.stubGlobal("fetch",transport);
    const provider=guardProvider(createCloudflareProvider({accountId:"a".repeat(32),apiToken:"synthetic-token"},true));
    const response=await withAiRequest(request(),async()=>{
      const denied=await reserveAiUsage("analysis");if(denied)return denied;
      try { await provider.generate({input:[{type:"text",text:"Rice"}],responseSchema:{}}); }
      catch(error) { return aiRoutingErrorResponse(error)!; }
      return NextResponse.json({error:"Unexpected execution"},{status:500});
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({code:"AI_ACCOUNTING_UNAVAILABLE"});
    expect(transport).not.toHaveBeenCalled();
    const attempts = control.mock.calls.map(([args]) => args as ControlArguments)
      .filter(args => args.p_operation === "attempt");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].p_provider).toBe("cloudflare");
    expect(await count()).toBe(0); // Database denied dispatch; credit refunded.
  });
  it("a transient primary outage reserves two provider attempts and one user credit",async()=>{
    const primary:AiProvider={id:"gemini",enabled:true,available:true,capabilities:{text:true,vision:true,maxImages:10,structuredJson:true},generate:vi.fn().mockRejectedValue({status:429})};
    const backup:AiProvider={...primary,id:"groq",generate:vi.fn().mockResolvedValue({outputText:"{}"})};
    const response=await withAiRequest(request(),async()=>{
      const denied=await reserveAiUsage("analysis");if(denied)return denied;
      const result=await generateWithFallback([guardProvider(primary),guardProvider(backup)],{input:[{type:"text",text:"rice"}],responseSchema:{}});
      return NextResponse.json(result);
    });
    expect(response.status).toBe(200);expect(await count()).toBe(1);
    expect((await db.query<{count:number}>("select sum(requests)::int as count from public.ai_provider_usage where window_kind='day'")).rows[0].count).toBe(2);
  });
  it("real disabled backup protocol preserves full nutrition through mocked HTTPS and replay",async()=>{
    const transport=vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:JSON.stringify(food)},finish_reason:"stop"}]}));
    vi.stubGlobal("fetch",transport);sdk.mockRejectedValue({status:503});
    const primary=guardProvider(createGeminiProvider("fake"));
    const backup=guardProvider(createGroqProvider("fake",true)); // Test-only explicit enablement.
    vi.spyOn(providerFactory,"getAiProvider").mockReturnValue({...primary,generate:args=>generateWithFallback([primary,backup],args)});
    const key=randomUUID(),first=await text(request(key));
    expect(first.status).toBe(200);expect(await first.json()).toMatchObject({entryMethod:"TEXT_AI",totalCalories:130});
    expect((await text(request(key))).headers.get("Idempotency-Replayed")).toBe("true");
    expect(await count()).toBe(1);expect(sdk).toHaveBeenCalledOnce();expect(transport).toHaveBeenCalledOnce();
  });
  it("an environment kill switch blocks AI without a new credit",async()=>{
    vi.stubEnv("AI_ENABLED","false");expect((await text(request())).status).toBe(503);
    expect(await count()).toBe(0);expect(sdk).not.toHaveBeenCalled();
  });
  it("rejects malformed request keys before admission",async()=>{
    expect((await text(request("too-short"))).status).toBe(400);
    expect(await count()).toBe(0);expect(control).not.toHaveBeenCalled();expect(sdk).not.toHaveBeenCalled();
  });
  it("persists transient cooldown across separate HTTP requests and returns Retry-After",async()=>{
    sdk.mockRejectedValue({status:429});
    expect((await text(request())).status).toBe(503);
    const second=await text(request());
    expect(second.status).toBe(503);expect(Number(second.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(sdk).toHaveBeenCalledOnce();expect(await count()).toBe(1); // Only the attempted call is charged.
  });
  it("a provider ignoring timeout cannot evade durable timeout settlement",async()=>{
    const generate=vi.fn(()=>new Promise<never>(()=>{}));
    const provider:AiProvider={id:"gemini",enabled:true,available:true,capabilities:{text:true,vision:true,maxImages:10,structuredJson:true},generate};
    const response=await withAiRequest(request(),async()=>{
      const denied=await reserveAiUsage("analysis");if(denied)return denied;
      try {
        await generateWithFallback([guardProvider(provider)],{input:[{type:"text",text:"rice"}],responseSchema:{}},{attemptTimeoutMs:100});
      } catch { return NextResponse.json({error:"Timed out"},{status:504}); }
      return NextResponse.json({error:"Unexpected completion"},{status:500});
    });
    expect(response.status).toBe(504);expect(generate).toHaveBeenCalledOnce();
    await vi.waitFor(async()=>{
      expect((await db.query<{cooling:boolean}>("select cooldown_until>now() as cooling from public.ai_provider_policy where provider='gemini'")).rows[0].cooling).toBe(true);
    });
    expect((await db.query<{settled:boolean}>("select settled from public.ai_provider_attempts")).rows[0].settled).toBe(false);
    expect(await count()).toBe(1);
  });
});
