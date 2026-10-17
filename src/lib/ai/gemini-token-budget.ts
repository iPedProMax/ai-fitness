import "server-only";
import { Buffer } from "node:buffer";
import { AiRoutingError } from "./errors";
import type { AiGenerationRequest } from "./types";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
// Application caps below the documented 1,048,576 input / 65,536 output limits.
// max_output_tokens includes thinking, so do not add another thinking allowance.
export const GEMINI_MAX_OUTPUT_TOKENS = 16_384;
export const GEMINI_MAX_INPUT_RESERVATION = 131_072;
export const GEMINI_IMAGE_RESOLUTION = "high";
// Google documents 1,120 maximum tokens per Gemini 3 high-resolution image.
export const GEMINI_IMAGE_TOKENS = 1_120;

/** Conservative local estimate, NOT an exact tokenizer or billing measurement.
 * Reserve one token per UTF-8 byte of serialized text/schema (rather than the
 * documented ~4 characters/token average), image allowances, 25% headroom, and
 * 2,048 protocol tokens. Base64 transport bytes are not image token counts.
 * Sources: ai.google.dev/gemini-api/docs/{tokens,media-resolution,thinking}.
 * Keep these settings and the adapter's fixed model/resolution/output cap aligned.
 */
export function geminiTokenReservation(request: AiGenerationRequest): number {
  const imageCount = request.input.filter(part => part.type === "image").length;
  if (imageCount > 10) throw new AiRoutingError("NO_COMPATIBLE_PROVIDER");
  const textAndSchema = JSON.stringify({
    input: request.input.map(part => part.type === "text" ? part :
      { type: part.type, mimeType: part.mimeType, resolution: GEMINI_IMAGE_RESOLUTION }),
    responseSchema: request.responseSchema,
  });
  const inputTokens = Math.ceil((Buffer.byteLength(textAndSchema, "utf8") + imageCount * GEMINI_IMAGE_TOKENS) * 1.25) + 2_048;
  // Reject instead of clamping: a larger payload must never get a smaller budget.
  if (inputTokens > GEMINI_MAX_INPUT_RESERVATION) throw new AiRoutingError("INPUT_TOO_LARGE");
  return inputTokens + GEMINI_MAX_OUTPUT_TOKENS;
}
