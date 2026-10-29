import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFreeTextProvider, freeTextBody, type FreeTextProviderId } from "./free-text";
import type { AiGenerationRequest } from "../types";
const fetchMock = vi.fn<typeof fetch>();
const req: AiGenerationRequest = { input:[{ type:"text", text:"How much protein?" }], responseSchema:{type:"object",properties:{reply:{type:"string"}},required:["reply"]} };
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("external text providers - no live requests", () => {
  it.each(["openrouter", "zai", "siliconflow", "huggingface", "cerebras"] as FreeTextProviderId[])("%s defaults disabled", async id => {
    await expect(createFreeTextProvider(id,"dummy").generate(req)).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("pins OpenRouter to its free aggregator and forbids photos", async () => {
    expect(JSON.parse(freeTextBody("openrouter",req)).model).toBe("openrouter/free");
    const photo = { type:"image" as const,mimeType:"image/png" as const,data:"iVBORw0KGgo=" };
    await expect(createFreeTextProvider("openrouter","dummy",true).generate({...req,input:[...req.input,photo]})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["openrouter", "zai", "siliconflow", "huggingface", "cerebras"] as FreeTextProviderId[])("%s returns one sanitized JSON text result", async id => {
    fetchMock.mockResolvedValue(Response.json({choices:[{finish_reason:"stop",message:{content:'{"reply":"A healthy meal includes protein."}'}}]}));
    const result = await createFreeTextProvider(id,"dummy",true).generate(req);
    expect(result.outputText).toBe('{"reply":"A healthy meal includes protein."}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\//);
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(init?.body as string).messages[0].content).toContain("JSON Schema");
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockReset();
  });
  it("rejects non-stop finish reason and never retries", async () => {
    fetchMock.mockResolvedValue(Response.json({choices:[{finish_reason:"length",message:{content:'{"reply":"partial"}'}}]}));
    await expect(createFreeTextProvider("openrouter","dummy",true).generate(req)).rejects.toThrow(/incomplete/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not expose upstream response body on rejection", async () => {
    fetchMock.mockResolvedValue(new Response("private token", {status:429}));
    const error = await createFreeTextProvider("openrouter","dummy",true).generate(req).catch(e=>e);
    expect(error.message).not.toContain("private token");
    expect(error.status).toBe(429);
  });
});