import "server-only";
import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { createOllamaLocalProvider, OLLAMA_LOCAL_MODEL } from "@/lib/ai/providers/ollama-local";
import { coachRequestSchema, coachPrompt, coachAnswerSchema, coachJsonSchema } from "@/lib/ai/coach-prompt";
import { readCoachUserSummary } from "@/lib/coach-user-context";

/** AURA local development only. No Supabase quota bypass on the existing AI routes. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const DAILY_LIMIT = 30;
let dayKey = "";
let usedToday = 0;
let inFlight = false;

function localDev(request: Request): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.AI_ENABLE_OLLAMA_LOCAL !== "true") return false;
  try {
    const url = new URL(request.url);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

function localOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

async function modelRunning(): Promise<boolean> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object" || !("models" in raw) || !Array.isArray(raw.models)) return false;
    return raw.models.some(item => item && typeof item === "object" && "name" in item && item.name === OLLAMA_LOCAL_MODEL);
  } catch { return false; }
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

/** Availability is scoped to AURA only; the scanner stays behind durable DB accounting. */
export async function GET(request: Request) {
  if (!localDev(request)) return NextResponse.json({available:false},{status:404,headers});
  const denied = await requireFoodApiAuth();
  if (denied) return denied;
  return NextResponse.json({available:await modelRunning(),devOnly:true},{headers});
}

export async function POST(request: Request) {
  if (!localDev(request)) return NextResponse.json({error:"Local development only."},{status:404,headers});
  if (!localOrigin(request)) return NextResponse.json({error:"Requests must come from this localhost app."},{status:403,headers});
  const denied = await requireFoodApiAuth();
  if (denied) return denied;
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({error:"JSON request required."},{status:415,headers});
  }
  let payload: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text,"utf8") > 8192) return NextResponse.json({error:"Question too long."},{status:413,headers});
    payload = JSON.parse(text);
  } catch { return NextResponse.json({error:"Invalid JSON."},{status:400,headers}); }
  const parsed = coachRequestSchema.safeParse(payload);
  if (!parsed.success || parsed.data.model !== "ollama-local") {
    return NextResponse.json({error:"Select Ollama Local and enter a valid question."},{status:400,headers});
  }
  if (inFlight) return NextResponse.json({error:"Local Ollama is busy. Try again shortly."},{status:429,headers});
  const currentDay = today();
  if (dayKey !== currentDay) { dayKey = currentDay; usedToday = 0; }
  if (usedToday >= DAILY_LIMIT) {
    return NextResponse.json({error:"Local development limit reached. Try tomorrow."},{status:429,headers});
  }
  usedToday += 1; // In-memory dev guard, not a Supabase credit. Resets with dev-server restart.
  inFlight = true;
  try {
    const savedSummary = parsed.data.useSavedData ? await readCoachUserSummary() : undefined;
    if (parsed.data.useSavedData && !savedSummary) {
      usedToday -= 1; // A failed data read must not consume a local generation slot.
      return NextResponse.json({error:"Your saved data could not be loaded. Try again or turn off personalization."},{status:503,headers});
    }
    const provider = createOllamaLocalProvider(true); // Bypass the DB quota guard ONLY in this dev route.
    const output = await provider.generate({
      input:[{type:"text",text:coachPrompt(parsed.data.message,parsed.data.history,savedSummary ?? undefined)}],
      responseSchema:coachJsonSchema,
      signal:request.signal,
    });
    const content = (output.outputText ?? "").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
    const answer = coachAnswerSchema.parse(JSON.parse(content));
    return NextResponse.json({reply:answer.reply,model:"ollama-local",local:true},{headers});
  } catch {
    return NextResponse.json({error:"Local Ollama couldn't answer. Check Ollama is running and try again."},{status:502,headers});
  } finally { inFlight = false; }
}