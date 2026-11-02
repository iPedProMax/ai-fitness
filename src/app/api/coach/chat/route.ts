import { NextResponse } from "next/server";
import { withAiRequest } from "@/lib/ai/request-control";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { reserveAiUsage } from "@/lib/ai-usage";
import { selectRequestedAiModel } from "@/lib/ai/selected-model";
import { aiRoutingErrorResponse } from "@/lib/ai/errors";
import { readCoachUserSummary } from "@/lib/coach-user-context";

import { coachRequestSchema, coachPrompt, coachAnswerSchema, coachJsonSchema } from "@/lib/ai/coach-prompt";
async function handlePost(request: Request) {
  const authError = await requireFoodApiAuth();
  if (authError) return authError;
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON body."},{status:400}); }
  const parsed = coachRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({error:"Enter a short coaching question and select an available AI."},{status:400});
  const selected = await selectRequestedAiModel(parsed.data.model, 0, "text");
  if (selected.error) return selected.error;
  // The server, not the browser, assembles the signed-in user's RLS-scoped summary.
  const savedSummary = parsed.data.useSavedData ? await readCoachUserSummary() : undefined;
  if (parsed.data.useSavedData && !savedSummary) return NextResponse.json({error:"Your saved data could not be loaded. Try again or turn off personalization."},{status:503,headers:{"Cache-Control":"private, no-store"}});
  // AURA currently shares the existing 60/day refinement allowance rather than
  // allowing unaccounted generation or inventing a new quota. UI makes this explicit.
  try {
    const denied = await reserveAiUsage("refinement");
    if (denied) return denied;
    const output = await selected.provider.generate({
      input: [{type:"text",text:coachPrompt(parsed.data.message,parsed.data.history,savedSummary ?? undefined)}],
      responseSchema: coachJsonSchema,
      signal: request.signal,
    });
    if (!output.outputText) return NextResponse.json({error:"AI returned an empty coaching reply."},{status:502});
    const cleaned = output.outputText.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
    // A 200 from the provider does not guarantee the expected JSON shape.
    // Never expose raw provider output or the user's private saved summary.
    const answer = (() => {
      try { return coachAnswerSchema.parse(JSON.parse(cleaned)); }
      catch { return null; }
    })();
    if (!answer) return NextResponse.json({
      error: "The selected AI replied, but its coaching response format was invalid.",
      code: "AI_COACH_REPLY_FORMAT",
    }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({reply:answer.reply,model:selected.provider.id},{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    const routing = aiRoutingErrorResponse(error);
    if (routing) return routing;
    // Safe, actionable provider rejection statuses. No API response bodies,
    // credentials, prompts, meal history, or SDK errors are sent to the client.
    const upstreamStatus = error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" ? error.status : null;
    if (upstreamStatus !== null && [400, 401, 403, 404, 422].includes(upstreamStatus)) {
      return NextResponse.json({
        error: `The selected AI provider rejected the request (HTTP ${upstreamStatus}).`,
        code: "AI_COACH_PROVIDER_REJECTED",
      }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({error:"Coach could not generate a response. Try later or use the free topic cards."},{status:502});
  }
}
export async function POST(request: Request) {
  return withAiRequest(request, () => handlePost(request));
}