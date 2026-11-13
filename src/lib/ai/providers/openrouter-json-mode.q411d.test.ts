import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFreeTextProvider, freeTextBody } from "./free-text";
import type { AiGenerationRequest } from "../types";

const request: AiGenerationRequest = {
  input: [{ type: "text", text: "Estimate nutrition for one cooked egg." }],
  responseSchema: {
    type: "object",
    properties: { reply: { type: "string" } },
    required: ["reply"],
  },
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("Q4.11D OpenRouter free JSON-mode safeguard (mocked only)", () => {
  it("asks for JSON and filters to compatible provider endpoints", () => {
    const body = JSON.parse(freeTextBody("openrouter", request));
    expect(body).toMatchObject({
      model: "openrouter/free",
      response_format: { type: "json_object" },
      provider: { require_parameters: true },
      stream: false,
      max_tokens: 4096,
    });
    expect(body.messages[0].content).toContain("JSON Schema");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not alter other text provider payloads", () => {
    for (const id of ["zai", "siliconflow", "huggingface", "cerebras"] as const) {
      const body = JSON.parse(freeTextBody(id, request));
      expect(body.response_format).toBeUndefined();
      expect(body.provider).toBeUndefined();
      expect(body.max_tokens).toBe(3072);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the single-attempt boundary and preserves a safe upstream status", async () => {
    fetchMock.mockResolvedValue(new Response("DO NOT LEAK PRIVATE UPSTREAM BODY", { status: 429 }));
    const error = await createFreeTextProvider("openrouter", "mock-key", true).generate(request).catch(value => value);
    expect(error.status).toBe(429);
    expect(error.message).not.toContain("PRIVATE");
    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.model).toBe("openrouter/free");
    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload.provider).toMatchObject({ require_parameters: true });
  });

  it("does not retry an incomplete response", async () => {
    fetchMock.mockResolvedValue(Response.json({
      choices: [{ finish_reason: "length", message: { content: '{"reply":"unfinished"}' } }],
    }));
    await expect(createFreeTextProvider("openrouter", "mock-key", true).generate(request)).rejects.toThrow(/incomplete/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});