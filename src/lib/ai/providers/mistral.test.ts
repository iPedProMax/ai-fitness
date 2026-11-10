import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMistralBody, createMistralProvider } from "./mistral";

const base = { responseSchema: {}, input: [{ type: "text" as const, text: "oats" }] };
afterEach(() => { vi.unstubAllGlobals(); });
describe("experimental Mistral vision transport", () => {
  it("remains disabled by default", async () => {
    const provider = createMistralProvider("secret");
    expect(provider.enabled).toBe(false);
    await expect(provider.generate(base)).rejects.toThrow();
  });
  it("allows only one photo and fixed model", () => {
    const image = { type: "image" as const, mimeType: "image/jpeg" as const, data: "YWJjZA==" };
    const body = JSON.parse(buildMistralBody({ ...base, input: [...base.input, image] }));
    expect(body.model).toBe("ministral-14b-2512");
    expect(body.messages[0].content[1].image_url.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(() => buildMistralBody({ ...base, input: [...base.input, image, image] })).toThrow();
  });
  it("returns complete text without leaking the API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: '{"foods":[]}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await createMistralProvider("private-key", true).generate(base);
    expect(result.outputText).toBe('{"foods":[]}');
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer private-key");
  });
  it("rejects unfinished responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: "length", message: { content: "" } }] }) }));
    await expect(createMistralProvider("private-key", true).generate(base)).rejects.toThrow("incomplete");
  });
});
