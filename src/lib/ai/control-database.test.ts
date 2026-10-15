import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ControlArguments, ControlResult } from "./control-store";

// Real PostgreSQL engine in memory; no credentials, HTTP, or live database.
// PGlite queues concurrent callers on one connection. A separate multi-connection
// PostgreSQL deployment check remains necessary before production activation.
const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const otherUser = "00000000-0000-4000-8000-000000000002";
const payload = "a".repeat(64);
export async function rpc(args: ControlArguments): Promise<ControlResult> {
  const result = await db.query<{ result: ControlResult }>(
    "select public.control_ai_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
    [args.p_operation,args.p_user_id,args.p_key,args.p_hash ?? null,args.p_kind ?? null,
      args.p_claim ?? null,args.p_provider ?? null,args.p_tokens ?? null,args.p_status ?? null,args.p_body ?? null]);
  return result.rows[0].result;
}
const begin = (key: string = randomUUID(), kind: "analysis" | "refinement" = "analysis", userId = user) =>
  rpc({ p_operation: "begin", p_user_id: userId, p_key: key, p_hash: payload, p_kind: kind });
async function claim(key: string) {
  const result = await begin(key);
  if (!("claim" in result)) throw new Error(JSON.stringify(result));
  return result.claim;
}
const attempt = (key: string, claimId: string, provider = "gemini", tokens = 100) =>
  rpc({ p_operation: "attempt", p_user_id: user, p_key: key, p_claim: claimId, p_provider: provider, p_tokens: tokens });
const count = async (column = "analyses_used") => (await db.query<Record<string, number>>(
  `select ${column} from public.ai_daily_usage where user_id=$1`, [user])).rows[0]?.[column] ?? 0;

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';");
  await db.exec(readFileSync("supabase/migrations/20261011_create_ai_daily_usage.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261015_ai_request_control.sql", "utf8"));
  await db.query("insert into auth.users values ($1),($2)", [user, otherUser]);
}, 30_000);
beforeEach(async () => {
  await db.exec("reset role; truncate public.ai_requests, public.ai_daily_usage, public.ai_provider_usage cascade; update public.ai_runtime_policy set enabled=true, paid_enabled=false, daily_budget_micros=0,monthly_budget_micros=0; update public.ai_provider_policy set enabled=true,free_tier_verified=true,max_concurrent=1000,cooldown_until=null,requests_per_minute=1000,requests_per_day=1000,tokens_per_minute=10000000,tokens_per_day=10000000,cost_per_attempt_micros=0;");
});
afterAll(async () => { await db.close(); });

describe("durable admission and distributed provider accounting", () => {
  it("admits one concurrent duplicate and reserves exactly one user credit", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 25 }, () => begin(key)));
    expect(results.filter(result => "claim" in result)).toHaveLength(1);
    expect(results.filter(result => "code" in result && result.code === "AI_REQUEST_IN_PROGRESS")).toHaveLength(24);
    expect(await count()).toBe(1);
  });
  it("rejects payload and task reuse but isolates users", async () => {
    const key = randomUUID(); await claim(key);
    expect(await rpc({ p_operation: "begin", p_user_id:user,p_key:key,p_hash:"b".repeat(64),p_kind:"analysis" })).toMatchObject({ code:"AI_KEY_CONFLICT" });
    expect(await begin(key,"refinement")).toMatchObject({ code:"AI_KEY_CONFLICT" });
    expect(await begin(key,"analysis",otherUser)).toHaveProperty("claim");
    expect(await count()).toBe(1);
  });
  it.each([200, 502, 503])("replays final status %i without another credit", async status => {
    const key = randomUUID(); const token = await claim(key);
    expect(await rpc({p_operation:"finish",p_user_id:user,p_key:key,p_claim:token,p_status:status,p_body:{ foods:[],error:status===200?null:"Failed" }})).toEqual({ok:true});
    expect(await begin(key)).toMatchObject({ replay:true,status });
    expect(await count()).toBe(1);
  });
  it("preserves separate 20/60 caps under concurrent submissions", async () => {
    const analyses = await Promise.all(Array.from({length:25},()=>begin()));
    expect(analyses.filter(result=>"claim" in result)).toHaveLength(20);
    const refinements = await Promise.all(Array.from({length:65},()=>begin(randomUUID(),"refinement")));
    expect(refinements.filter(result=>"claim" in result)).toHaveLength(60);
    expect(await count()).toBe(20); expect(await count("refinements_used")).toBe(60);
    const day = (await db.query<{ day:string }>("select usage_date::text as day from public.ai_daily_usage limit 1")).rows[0].day;
    const expected = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    expect(day).toBe(expected);
  });
  it("counts primary and fallback attempts but only one user credit", async () => {
    const key=randomUUID(), token=await claim(key);
    expect(await attempt(key,token)).toEqual({ok:true});
    expect(await attempt(key,token,"groq")).toEqual({ok:true});
    expect(await attempt(key,token,"groq")).toMatchObject({code:"AI_ATTEMPT_LIMIT"});
    expect(await count()).toBe(1);
    expect((await db.query<{count:number}>("select sum(requests)::int as count from public.ai_provider_usage where window_kind='day'")).rows[0].count).toBe(2);
  });
  it("serializes global request caps across distinct concurrent requests", async () => {
    await db.exec("update public.ai_provider_policy set requests_per_minute=2 where provider='gemini'");
    const keys=Array.from({length:5},()=>randomUUID());
    const claims=await Promise.all(keys.map(claim));
    const results=await Promise.all(keys.map((key,i)=>attempt(key,claims[i])));
    expect(results.filter(result=>"ok" in result)).toHaveLength(2);
    expect(results.filter(result=>"code" in result&&result.code==="AI_GLOBAL_LIMIT")).toHaveLength(3);
  });
  it("does not partially consume windows on token denial", async () => {
    const key=randomUUID(), token=await claim(key);
    await db.exec("update public.ai_provider_policy set tokens_per_day=99 where provider='gemini'");
    expect(await attempt(key,token)).toMatchObject({code:"AI_GLOBAL_LIMIT"});
    expect((await db.query("select * from public.ai_provider_usage")).rows).toHaveLength(0);
  });
  it.each(["daily_budget_micros", "monthly_budget_micros"])("enforces global %s across providers", async field => {
    const key=randomUUID(),token=await claim(key);
    const window=field.startsWith("daily")?"day":"month";
    await db.query("insert into public.ai_provider_usage(provider,window_kind,window_start,cost_micros) values ('_global',$1,date_trunc($1,now() at time zone 'UTC') at time zone 'UTC',1)",[window]);
    expect(await attempt(key,token)).toMatchObject({code:"AI_GLOBAL_BUDGET"});
    expect((await db.query("select * from public.ai_provider_usage where provider='gemini'")).rows).toHaveLength(0);
  });
  it("missing policy fails closed before any user credit",async()=>{
    await db.exec("delete from public.ai_runtime_policy");
    expect(await begin()).toMatchObject({code:"AI_ACCOUNTING_UNAVAILABLE"});
    expect(await count()).toBe(0);
    await db.exec("insert into public.ai_runtime_policy(singleton) values(true)");
  });
  it("rejects a null operation without reserving provider capacity",async()=>{
    const key=randomUUID(),token=await claim(key);
    await expect(db.query("select public.control_ai_request(null,$1,$2,p_claim=>$3,p_provider=>'gemini',p_tokens=>100)",[user,key,token])).rejects.toThrow("Invalid operation");
    expect((await db.query("select * from public.ai_provider_usage")).rows).toHaveLength(0);
  });
  it("Gemini provider days follow Pacific midnight including DST, independently of UTC budgets",async()=>{
    const window=async(instant:string)=>(await db.query<{start:string}>("select public.ai_provider_window_start('gemini','day',$1)::text as start",[instant])).rows[0].start;
    expect(await window("2026-10-15T23:59:00Z")).toBe(await window("2026-10-16T00:01:00Z"));
    expect(await window("2026-10-16T06:59:00Z")).not.toBe(await window("2026-10-16T07:01:00Z"));
    expect(await window("2026-12-16T07:59:00Z")).not.toBe(await window("2026-12-16T08:01:00Z"));
  });
  it("shared in-flight capacity and provider cooldown block independent requests",async()=>{
    await db.exec("update public.ai_provider_policy set max_concurrent=1 where provider='gemini'");
    const first=randomUUID(),second=randomUUID(),one=await claim(first),two=await claim(second);
    expect(await attempt(first,one)).toEqual({ok:true});
    expect(await attempt(second,two)).toMatchObject({code:"AI_PROVIDER_CONCURRENCY"});
    expect(await rpc({p_operation:"settle",p_user_id:user,p_key:first,p_claim:one,p_provider:"gemini",p_status:429})).toEqual({ok:true});
    expect(await attempt(second,two)).toMatchObject({code:"AI_PROVIDER_COOLDOWN"});
    await db.exec("update public.ai_provider_policy set cooldown_until=now()-interval '1 minute'");
    expect(await attempt(second,two)).toEqual({ok:true});
    expect(await count()).toBe(2);
  });
  it("timeouts retain their concurrency lease until expiry without refunding budgets",async()=>{
    await db.exec("update public.ai_provider_policy set max_concurrent=1 where provider='gemini'");
    const first=randomUUID(),second=randomUUID(),one=await claim(first),two=await claim(second);
    await attempt(first,one);
    await rpc({p_operation:"settle",p_user_id:user,p_key:first,p_claim:one,p_provider:"gemini",p_status:504});
    await db.exec("update public.ai_provider_policy set cooldown_until=now()-interval '1 minute'");
    expect(await attempt(second,two)).toMatchObject({code:"AI_PROVIDER_CONCURRENCY"});
    await db.exec("update public.ai_provider_attempts set lease_until=now()-interval '1 minute'");
    expect(await attempt(second,two)).toEqual({ok:true});
    expect((await db.query<{count:number}>("select sum(requests)::int as count from public.ai_provider_usage where window_kind='day'")).rows[0].count).toBe(2);
  });
  it("kill switch blocks new credits and already-admitted outbound attempts", async () => {
    const key=randomUUID(),token=await claim(key);
    await db.exec("update public.ai_runtime_policy set enabled=false");
    expect(await begin()).toMatchObject({code:"AI_DISABLED"});
    expect(await attempt(key,token)).toMatchObject({code:"AI_DISABLED"});
    expect(await count()).toBe(1);
  });
  it("rejects paid or unverified providers even when paid toggle is changed", async () => {
    const key=randomUUID(),token=await claim(key);
    await db.exec("update public.ai_runtime_policy set paid_enabled=true; update public.ai_provider_policy set cost_per_attempt_micros=1 where provider='groq'");
    expect(await attempt(key,token,"groq")).toMatchObject({code:"AI_PROVIDER_DISABLED"});
    await db.exec("update public.ai_provider_policy set free_tier_verified=false where provider='gemini'");
    expect(await attempt(key,token)).toMatchObject({code:"AI_PROVIDER_DISABLED"});
  });
  it("requires matching claim and never restarts interrupted or expired requests", async () => {
    const key=randomUUID(),token=await claim(key);
    expect(await attempt(key,randomUUID())).toMatchObject({code:"AI_INVALID_CLAIM"});
    await db.exec("update public.ai_requests set created_at=now()-interval '3 minutes'");
    expect(await begin(key)).toMatchObject({code:"AI_REQUEST_INTERRUPTED"});
    expect(await attempt(key,token)).toMatchObject({code:"AI_INVALID_CLAIM"});
    await db.exec("update public.ai_requests set created_at=now()-interval '2 days'");
    expect(await begin(key)).toMatchObject({code:"AI_REPLAY_EXPIRED"});
    expect(await count()).toBe(1);
  });
  it("denies browser roles all control RPC and direct table access", async () => {
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(begin()).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.ai_requests")).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    expect(await begin()).toHaveProperty("claim");
    await expect(db.query("select * from public.ai_requests")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });
});
