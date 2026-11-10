import "server-only";
import { Buffer } from "node:buffer";
import { AiRoutingError } from "./errors";
import { buildMistralBody } from "./providers/mistral";
import type { AiGenerationRequest } from "./types";

/**
 * Q4.4: Reserve Mistral tokens from the ACTUAL outbound JSON request.
 * Mistral's adapter substitutes a compact strict food schema for the generic
 * Gemini food schema. Counting the generic schema previously rejected normal
 * barcode text requests before dispatch. This remains intentionally generous
 * with token accounting (1 token per 2 UTF-8 bytes + output and fixed headroom).
 * It is a conservative reservation, not precise tokenizer output.
 */
export const MISTRAL_LOCAL_TOKEN_CAP = 12_000;
export function mistralTokenReservation(request: AiGenerationRequest): number {
  // This function validates request parts, body size and model choice through
  // the same serializer used for the network request. Nothing is sent here.
  const outgoing = buildMistralBody(request);
  const json = JSON.parse(outgoing) as { max_tokens?: unknown };
  if (typeof json.max_tokens !== "number" || !Number.isSafeInteger(json.max_tokens) ||
      json.max_tokens <= 0 || json.max_tokens > 4096) {
    throw new AiRoutingError("INPUT_TOO_LARGE");
  }
  const imageCount = request.input.filter(part => part.type === "image").length;
  const tokens = Math.ceil(Buffer.byteLength(outgoing, "utf8") / 2) +
    json.max_tokens + 512 + imageCount * 2048;
  if (tokens > MISTRAL_LOCAL_TOKEN_CAP) throw new AiRoutingError("INPUT_TOO_LARGE");
  return tokens;
}
