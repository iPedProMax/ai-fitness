import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mistralTokenReservation, MISTRAL_LOCAL_TOKEN_CAP } from "./mistral-token-budget";
import { buildMistralBody } from "./providers/mistral";
import { geminiLabelFoodAnalysisJsonSchema } from "./gemini-label-nutrients";
import { AiRoutingError } from "./errors";

const request = (text: string) => ({
  input: [{ type: "text" as const, text }],
  responseSchema: geminiLabelFoodAnalysisJsonSchema,
});

describe("Mistral Text AI accounting with compact outbound schema", () => {
  it("admits normal barcode/manual nutrition prompts with complete response schema", () => {
    // Approximates Khalories' long standard instruction prefix + one product.
    const normal = request("Estimate nutrition for one 25 g packaged snack. ".repeat(80));
    const actual = JSON.parse(buildMistralBody(normal));
    expect(actual.response_format.json_schema.name).toBe("manual_food_nutrition");
    const reserved = mistralTokenReservation(normal);
    expect(reserved).toBeGreaterThan(actual.max_tokens);
    expect(reserved).toBeLessThanOrEqual(MISTRAL_LOCAL_TOKEN_CAP);
  });
  it("still rejects genuinely excessive text before dispatch", () => {
    expect(() => mistralTokenReservation(request("very long prompt ".repeat(3000))))
      .toThrowError(expect.objectContaining({ code: "INPUT_TOO_LARGE" }));
  });
  it("does not accept two images or remove existing serialization guards", () => {
    const image = { type: "image" as const, mimeType: "image/png" as const, data: "YWJjZA==" };
    expect(() => mistralTokenReservation({ ...request("food"), input: [
      { type: "text", text: "food" }, image, image,
    ] })).toThrow(AiRoutingError);
  });
  it("never invokes a network call or changes AI billing during reservation", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    try { expect(mistralTokenReservation(request("100 g cooked rice"))).toBeGreaterThan(0); expect(spy).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  });
});
