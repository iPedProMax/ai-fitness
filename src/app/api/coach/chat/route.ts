import { NextResponse } from "next/server";
import { withAiRequest } from "@/lib/ai/request-control";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { reserveAiUsage } from "@/lib/ai-usage";
import { selectRequestedAiModel } from "@/lib/ai/selected-model";
import { aiRoutingErrorResponse } from "@/lib/ai/errors";

import { coachRequestSchema, coachPrompt, coachAnswerSchema, coachJsonSchema } from "@/lib/ai/coach-prompt";
async function handlePost(request: Request) {
  const authError = await requireFoodApiAuth();
  if (authError) return authError;
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON body."},{status:400}); }
  const parsed = coachRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({error:"Enter a short coaching question and select an available AI."},{status:400});
  const selected = await selectRequestedAiModel(parsed.data.model, 0);
  if (selected.error) return selected.error;
  // AURA currently shares the existing 60/day refinement allowance rather than
  // allowing unaccounted generation or inventing a new quota. UI makes this explicit.
  try {
    const denied = await reserveAiUsage("refinement");
    if (denied) return denied;
    const output = await selected.provider.generate({
      input: [{type:"text",text:coachPrompt(parsed.data.message,parsed.data.history)}],
      responseSchema: coachJsonSchema,
      signal: request.signal,
    });
    if (!output.outputText) return NextResponse.json({error:"AI returned an empty coaching reply."},{status:502});
    const cleaned = output.outputText.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
    const answer = coachAnswerSchema.parse(JSON.parse(cleaned));
    return NextResponse.json({reply:answer.reply,model:selected.provider.id},{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    const routing = aiRoutingErrorResponse(error);
    if (routing) return routing;
    return NextResponse.json({error:"Coach could not generate a response. Try later or use the free topic cards."},{status:502});
  }
}
export async function POST(request: Request) {
  return withAiRequest(request, () => handlePost(request));
}