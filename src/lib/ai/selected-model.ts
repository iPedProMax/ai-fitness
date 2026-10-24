import "server-only";
import { NextResponse } from "next/server";
import { isAiModelId } from "./model-catalog";
import { getAiProvider } from "./provider";
import type { AiProvider } from "./types";

/** Always use the application's existing default Gemini model.
 * An old client cannot bypass the single-model policy by submitting `model`.
 * Existing request/credit/provider-budget protections run as before. */
export async function selectRequestedAiModel(rawModel: unknown, imageCount: number):
  Promise<{ provider: AiProvider; error?: never } | { error: NextResponse; provider?: never }> {
  const model = rawModel === undefined || rawModel === null ? "gemini" : rawModel;
  const fail = (error: string, code: string, status: number) => ({
    error: NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "private, no-store" } }),
  });
  if (!isAiModelId(model)) return fail("Invalid AI model request.", "AI_INVALID_MODEL", 400);
  if (model !== "gemini") {
    return fail("AI model selection is no longer supported. Please retry with the default model.", "AI_MODEL_UNAVAILABLE", 503);
  }
  if (!Number.isInteger(imageCount) || imageCount < 0 || imageCount > 10) {
    return fail("Too many photos for this AI model.", "AI_MODEL_UNSUPPORTED", 422);
  }
  const provider = getAiProvider("gemini");
  if (!provider || !provider.enabled || !provider.available) {
    return fail("AI analysis is currently unavailable.", "AI_MODEL_UNAVAILABLE", 503);
  }
  if ((imageCount > 0 && (!provider.capabilities.vision || imageCount > provider.capabilities.maxImages)) ||
      (imageCount === 0 && !provider.capabilities.text)) {
    return fail("This AI model cannot process that input.", "AI_MODEL_UNSUPPORTED", 422);
  }
  return { provider };
}
