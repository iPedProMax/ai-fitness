import "server-only";
import { NextResponse } from "next/server";
import { getAiProvider } from "./provider";
import type { AiProvider } from "./types";

/** Provider choice is explicit; Gemini version switching remains disabled. */
export async function selectRequestedAiModel(rawModel: unknown, imageCount: number):
  Promise<{ provider: AiProvider; error?: never } | { error: NextResponse; provider?: never }> {
  const fail = (error: string, code: string, status: number) => ({
    error: NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "private, no-store" } }),
  });
  const model = rawModel == null ? "gemini" : rawModel;
  if (typeof model !== "string" || !["gemini", "cloudflare", "groq", "mistral"].includes(model)) {
    return fail("Invalid or unsupported AI provider.", "AI_INVALID_MODEL", 400);
  }
  if (!Number.isInteger(imageCount) || imageCount < 0 || imageCount > 10) {
    return fail("Too many photos for this AI analysis.", "AI_MODEL_UNSUPPORTED", 422);
  }
  if ((model === "groq" && imageCount > 2) || (model === "cloudflare" && imageCount > 1) || (model === "mistral" && imageCount > 1)) {
    return fail("This AI provider cannot process that number of photos.", "AI_MODEL_UNSUPPORTED", 422);
  }
  const provider = getAiProvider(model);
  if (!provider || !provider.enabled || !provider.available) {
    return fail("AI analysis is currently unavailable.", "AI_MODEL_UNAVAILABLE", 503);
  }
  if ((imageCount > 0 && (!provider.capabilities.vision || imageCount > provider.capabilities.maxImages)) ||
      (imageCount === 0 && !provider.capabilities.text)) {
    return fail("This AI provider cannot process that input.", "AI_MODEL_UNSUPPORTED", 422);
  }
  return { provider };
}
