import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFreeTextProvider, freeTextBody } from "./free-text";
import type { AiGenerationRequest } from "../types";
import { getProviderMaxImages } from "../provider-image-limits";
const fetchMock = vi.fn<typeof fetch>();
const photo = { type: "image" as const, data: "aGVsbG8=", mimeType: "image/jpeg" as const };
const req: AiGenerationRequest = {
  input: [{ type: "text", text: "Analyze this meal" }, photo],
  responseSchema: { type: "object", properties: { calories: { type: "number" } } },
};
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("Phase 2 free vision - offline only", () => {
  it.each(["zai", "openrouter"] as const)("%s generates multimodal user content", id => {
    const body = JSON.parse(freeTextBody(id, req));
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,aGVsbG8=");
    expect(body.model).toBe(id === "zai" ? "glm-4.6v-flash" : "openrouter/free");
    expect(createFreeTextProvider(id, "dummy", true).capabilities.vision).toBe(true);
  });
  it("rejects third Z.ai photo or second OpenRouter photo", () => {
    expect(() => freeTextBody("zai", { ...req, input: [...req.input, photo, photo] })).toThrow();
    expect(() => freeTextBody("openrouter", { ...req, input: [...req.input, photo] })).toThrow();
    expect(getProviderMaxImages("zai")).toBe(2);
    expect(getProviderMaxImages("openrouter")).toBe(1);
  });
  it("still rejects images for text-only Cerebras", () => {
    expect(() => freeTextBody("cerebras", req)).toThrow();
  });
  it("one selected provider, one fetch, no fallback", async () => {
    fetchMock.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"calories":120}' } }] }));
    const result = await createFreeTextProvider("zai", "dummy", true).generate(req);
    expect(result.outputText).toBe('{"calories":120}');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.z.ai/api/paas/v4/chat/completions");
  });
  it("disabled by default despite dummy key", async () => {
    await expect(createFreeTextProvider("zai", "dummy").generate(req)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});