import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFreeTextProvider, freeTextBody } from "./free-text";
import type { AiGenerationRequest } from "../types";

const foodRequest: AiGenerationRequest = {
  input: [
    { type: "text", text: "Respond with nutrition JSON for this one food." },
    { type: "image", data: "aGVsbG8=", mimeType: "image/jpeg" },
  ],
  responseSchema: { type: "object", properties: { calories: { type: "number" } } },
};
const textRequest: AiGenerationRequest = {
  ...foodRequest,
  input: [{ type: "text", text: "Estimate the calories for one egg in JSON." }],
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Q4.12H OpenRouter pinned free Vision + safe diagnostics (no network)", () => {
  it("uses a pinned free image model with JSON mode and required parameters", () => {
    const body = JSON.parse(freeTextBody("openrouter", foodRequest));
    expect(body.model).toBe("google/gemma-4-26b-a4b-it:free");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,aGVsbG8=");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the OpenRouter Text free router and the Z.ai Vision model", () => {
    expect(JSON.parse(freeTextBody("openrouter", textRequest)).model).toBe("openrouter/free");
    expect(JSON.parse(freeTextBody("zai", foodRequest)).model).toBe("glm-4.6v-flash");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records an allowlisted status on upstream failure without exposing its body", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("TOP_SECRET_RESPONSE_BODY", { status: 429 }));
    const err = await createFreeTextProvider("openrouter", "mock-key", true).generate(foodRequest).catch(value => value);
    expect(err.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledOnce();
    const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(sent.model).toBe("google/gemma-4-26b-a4b-it:free");
    const logged = warnSpy.mock.calls.map(parts => parts.join(" ")).join(" ");
    expect(logged).toContain('"stage":"UPSTREAM_HTTP"');
    expect(logged).toContain('"status":429');
    expect(logged).not.toMatch(/TOP_SECRET_RESPONSE_BODY|mock-key|aGVsbG8=/);
  });

  it("labels malformed upstream envelopes without leaking content or retrying", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json({ secret: "DO_NOT_LOG_THIS_PAYLOAD" }));
    await expect(createFreeTextProvider("openrouter", "mock-key", true).generate(foodRequest)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
    const logged = warnSpy.mock.calls.map(parts => parts.join(" ")).join(" ");
    expect(logged).toContain('"stage":"INVALID_RESPONSE_ENVELOPE"');
    expect(logged).not.toMatch(/DO_NOT_LOG_THIS_PAYLOAD|mock-key|aGVsbG8=/);
  });

  it("labels incomplete output without retrying or logging the model response", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json({ choices: [{ finish_reason: "length", message: { content: "SECRET_PARTIAL" } }] }));
    await expect(createFreeTextProvider("openrouter", "mock-key", true).generate(foodRequest)).rejects.toThrow(/incomplete/);
    expect(fetchMock).toHaveBeenCalledOnce();
    const logged = warnSpy.mock.calls.map(parts => parts.join(" ")).join(" ");
    expect(logged).toContain('"stage":"EMPTY_OR_INCOMPLETE"');
    expect(logged).not.toMatch(/SECRET_PARTIAL|mock-key|aGVsbG8=/);
  });
});
