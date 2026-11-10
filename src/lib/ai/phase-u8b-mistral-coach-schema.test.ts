import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMistralBody, MISTRAL_MODEL } from "./providers/mistral";

const coachRequest = {
  input: [{ type: "text" as const, text: "Give three short tips. Return JSON with reply." }],
  responseSchema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] },
};

describe("Phase U8B: Mistral structured coaching replies", () => {
  it("enforces a reply key in a schema-constrained response, with the fixed model", () => {
    const body = JSON.parse(buildMistralBody(coachRequest));
    expect(body.model).toBe(MISTRAL_MODEL);
    expect(body.model).toBe("ministral-14b-2512");
    expect(body.messages).toEqual([{ role: "user", content: coachRequest.input[0].text }]);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "coach_reply", strict: true, schema: {
        type: "object", properties: { reply: { type: "string" } },
        required: ["reply"], additionalProperties: false,
      } },
    });
  });
  it("preserves JSON object mode for nutrition text requests", () => {
    const body = JSON.parse(buildMistralBody({
      input: [{ type: "text", text: "Estimate rice nutrition in JSON" }],
      responseSchema: { type: "object", properties: { foods: { type: "array" } }, required: ["foods"] },
    }));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(1300);
  });
  it("keeps existing multimodal formatting and JSON mode for provider tests (no scanner activation)", () => {
    const body = JSON.parse(buildMistralBody({
      ...coachRequest,
      input: [...coachRequest.input, { type: "image" as const, mimeType: "image/png" as const, data: "YWJjZA==" }],
    }));
    expect(body.messages[0].content[1].type).toBe("image_url");
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});