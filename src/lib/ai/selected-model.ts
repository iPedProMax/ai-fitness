import "server-only";
import { NextResponse } from "next/server";
import { aiModelCatalog, isAiModelId } from "./model-catalog";
import { getAiProvider } from "./provider";
import type { AiProvider } from "./types";

export function selectRequestedAiModel(rawModel: unknown, imageCount: number):
  { provider: AiProvider; error?: never } | { error: NextResponse; provider?: never } {
  const model = rawModel === undefined || rawModel === null ? "gemini" : rawModel;
  const fail = (error: string, code: string, status: number) => ({
    error: NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "private, no-store" } }),
  });
  if (!isAiModelId(model)) return fail("Choose a valid AI model.", "AI_INVALID_MODEL", 400);
  const definition = aiModelCatalog.find(item => item.id === model)!;
  // Do not assert image incompatibility for integrations we have not built.
  if (["openrouter", "mistral", "huggingface", "cerebras"].includes(model)) {
    return fail("This AI model is not enabled yet. Choose another model.", "AI_MODEL_UNAVAILABLE", 503);
  }
  if ((imageCount > 0 && (!definition.vision || imageCount > definition.maxImages)) ||
      (imageCount === 0 && !definition.text)) {
    return fail("This AI model cannot process that input. Choose a compatible model.", "AI_MODEL_UNSUPPORTED", 422);
  }
  const provider = getAiProvider(model);
  if (!provider || !provider.enabled || !provider.available) {
    return fail("This AI model is not enabled yet. Choose another model.", "AI_MODEL_UNAVAILABLE", 503);
  }
  return { provider };
}
