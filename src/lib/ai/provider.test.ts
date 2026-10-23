// This suite tests route/adapter behavior. Durable admission and production
// accounting are exercised without this mock in request-control integration tests.
vi.mock("@/lib/ai/request-control", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/ai/request-control")>(),
  guardProvider: (provider: import("@/lib/ai/types").AiProvider) => provider,
}));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, clientOptions } = vi.hoisted(() => ({
  createMock: vi.fn(),
  clientOptions: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      clientOptions(options);
    }
    interactions = { create: createMock };
  },
}));

import { getAiProvider } from "./provider";

const schema = {
  type: "object",
  properties: { notes: { type: "string" } },
  required: ["notes"],
};

describe("server AI provider foundation", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-provider-key");
    createMock.mockReset();
    clientOptions.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("disables AI when Gemini is unconfigured without constructing a client", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getAiProvider()).toBeNull();
    expect(clientOptions).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("selects only Gemini and makes no SDK call before generation", () => {
    const provider = getAiProvider();
    expect(provider?.id).toBe("gemini");
    expect(clientOptions).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("preserves prompt text, ordered images, JSON schema, and raw output", async () => {
    const outputText = '{"notes":"keep this JSON unchanged"}';
    createMock.mockResolvedValue({ output_text: outputText });

    const result = await getAiProvider()!.generate({
      input: [
        { type: "text", text: "Exact prompt\nwith whitespace.\n" },
        { type: "image", data: "Zm9vZA==", mimeType: "image/jpeg" },
        { type: "text", text: "Label evidence" },
        { type: "image", data: "bGFiZWw=", mimeType: "image/png" },
        { type: "image", data: "c2NhbGU=", mimeType: "image/webp" },
      ],
      responseSchema: schema,
    });

    expect(clientOptions).toHaveBeenCalledExactlyOnceWith({ apiKey: "test-provider-key" });
    expect(createMock).toHaveBeenCalledExactlyOnceWith({
      model: "gemini-3.5-flash-lite",
      input: [
        { type: "text", text: "Exact prompt\nwith whitespace.\n" },
        { type: "image", data: "Zm9vZA==", mime_type: "image/jpeg", resolution: "high" },
        { type: "text", text: "Label evidence" },
        { type: "image", data: "bGFiZWw=", mime_type: "image/png", resolution: "high" },
        { type: "image", data: "c2NhbGU=", mime_type: "image/webp", resolution: "high" },
      ],
      response_format: { type: "text", mime_type: "application/json", schema },
      generation_config: { max_output_tokens: 16_384 },
      store: false,
    }, { signal: expect.any(AbortSignal), timeout_ms: 50_000, retries: { strategy: "none" } });
    expect(result).toEqual({ outputText });
  });

  it.each([undefined, "", "not JSON"])(
    "leaves output %j to existing route validation and error handling",
    async (outputText) => {
      createMock.mockResolvedValue({ output_text: outputText });
      await expect(getAiProvider()!.generate({
        input: [{ type: "text", text: "Refine the confirmed addition" }],
        responseSchema: schema,
      })).resolves.toEqual({ outputText });
      expect(createMock).toHaveBeenCalledOnce();
    },
  );

  it("propagates provider failure without adding retry or fallback calls", async () => {
    const error = new Error("Synthetic provider failure");
    createMock.mockRejectedValue(error);
    await expect(getAiProvider()!.generate({
      input: [{ type: "text", text: "Estimate rice" }],
      responseSchema: schema,
    })).rejects.toBe(error);
    expect(createMock).toHaveBeenCalledOnce();
  });
  it("rejects output marked incomplete even if its truncated JSON could parse", async () => {
    createMock.mockResolvedValue({ status: "incomplete", output_text: '{"notes":"partial"}' });
    await expect(getAiProvider()!.generate({ input: [{ type: "text", text: "Rice" }], responseSchema: schema }))
      .rejects.toThrow("incomplete");
    expect(createMock).toHaveBeenCalledOnce();
  });
});
