import { describe, expect, it } from "vitest";
import { foodAnalysisJsonSchema } from "@/lib/food-analysis";
import { foodAnalysisPrompt } from "@/lib/food-analysis-prompt";
import { geminiTokenReservation, GEMINI_MAX_OUTPUT_TOKENS, GEMINI_IMAGE_TOKENS } from "./gemini-token-budget";
import type { AiGenerationRequest } from "./types";

const request = (text = "Estimate 100 g cooked rice", images = 0): AiGenerationRequest => ({
  input: [{ type: "text", text }, ...Array.from({ length: images }, () => ({
    type: "image" as const, data: "AA==", mimeType: "image/jpeg" as const,
  }))], responseSchema: foodAnalysisJsonSchema,
});

describe("Gemini per-request conservative token reservation", () => {
  it("reserves a practical amount for the real photo prompt/schema and ten images", () => {
    const tokens = geminiTokenReservation(request(foodAnalysisPrompt, 10));
    expect(tokens).toBeGreaterThan(GEMINI_MAX_OUTPUT_TOKENS + 10 * GEMINI_IMAGE_TOKENS);
    expect(tokens).toBeLessThan(100_000);
    expect(Number.isSafeInteger(tokens)).toBe(true);
  });
  it("grows with text, schema, and image count instead of using a model-wide constant", () => {
    const original = request();
    const base = geminiTokenReservation(original);
    expect(geminiTokenReservation(request("rice".repeat(3000)))).toBeGreaterThan(base);
    expect(geminiTokenReservation(request(undefined, 1))).toBeGreaterThan(base);
    expect(geminiTokenReservation({ ...original, responseSchema: { description: "schema".repeat(2000) } })).toBeGreaterThan(base);
  });
  it("reserves UTF-8 bytes conservatively for Unicode and escaped text", () => {
    const ascii = geminiTokenReservation(request("abc".repeat(500)));
    expect(geminiTokenReservation(request("寿司🥚".repeat(500)))).toBeGreaterThan(ascii);
    expect(geminiTokenReservation(request("\u0000".repeat(1500)))).toBeGreaterThan(ascii);
  });
  it("does not count base64 bytes as image tokens", () => {
    const original = request(undefined, 1);
    const larger = { ...original, input: original.input.map(part => part.type === "image"
      ? { ...part, data: "A".repeat(1_000_000) } : part) };
    expect(geminiTokenReservation(larger)).toBe(geminiTokenReservation(original));
  });
  it("rejects oversized input without silently clamping its reservation", () => {
    expect(() => geminiTokenReservation(request("x".repeat(200_000)))).toThrowError(expect.objectContaining({ code: "INPUT_TOO_LARGE" }));
    expect(() => geminiTokenReservation(request(undefined, 11))).toThrow();
  });
});
