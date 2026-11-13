import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFreeTextProvider, freeTextBody } from "./free-text";
import type { AiGenerationRequest } from "../types";

const req: AiGenerationRequest = {
  input: [{ type: "text", text: "Approximate nutrition of a serving of rice." }],
  responseSchema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] },
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OpenRouter free Text completion - single attempt, no paid fallback", () => {
  it("allows more room for text JSON without changing image or other-provider budgets", () => {
    expect(JSON.parse(freeTextBody("openrouter", req))).toMatchObject({
      model: "openrouter/free", max_tokens: 4096,
      response_format: { type: "json_object" }, provider: { require_parameters: true },
    });
    expect(JSON.parse(freeTextBody("openrouter", {
      ...req, input: [...req.input, { type: "image", mimeType: "image/png", data: "aGVsbG8=" }],
    })).max_tokens).toBe(3072);
    expect(JSON.parse(freeTextBody("zai", req)).max_tokens).toBe(3072);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete free-router output without retrying or exposing private content", async () => {
    // Test creates a simulated upstream response only. No network/API usage.
    fetchMock.mockResolvedValue(Response.json({
      choices: [{ finish_reason: "length", message: { content: "PRIVATE_NUTRITION_OUTPUT" } }],
    }));
    const err = await createFreeTextProvider("openrouter", "FAKE_PRIVATE_KEY", true)
      .generate(req).catch(value => value);
    expect(err.message).toBe("Text provider output incomplete");
    expect(fetchMock).toHaveBeenCalledOnce();
    const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(sent.model).toBe("openrouter/free");
    expect(sent.max_tokens).toBe(4096);
    expect(sent.models).toBeUndefined(); // No paid or alternative model fallback.
  });

  it("accepts complete JSON and still makes exactly one request", async () => {
    fetchMock.mockResolvedValue(Response.json({
      choices: [{ finish_reason: "stop", message: { content: '{"reply":"OK"}' } }],
    }));
    const result = await createFreeTextProvider("openrouter", "FAKE_PRIVATE_KEY", true).generate(req);
    expect(result.outputText).toBe('{"reply":"OK"}');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});