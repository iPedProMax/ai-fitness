import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOllamaLocalProvider, ollamaLocalBody, OLLAMA_LOCAL_ENDPOINT, OLLAMA_LOCAL_MODEL } from "./ollama-local";
import type { AiGenerationRequest } from "../types";

const transport = vi.fn<typeof fetch>();
const basic: AiGenerationRequest = { input: [{type:"text", text:"Estimate cooked rice"}], responseSchema: {type:"object", properties:{ notes:{type:"string"} }, required:["notes"]} };
const image = { type:"image" as const, data:"iVBORw0KGgo=", mimeType:"image/png" as const };
beforeEach(() => { transport.mockReset(); vi.stubGlobal("fetch", transport); });
afterEach(() => vi.unstubAllGlobals());

describe("local Ollama vision adapter: no paid endpoints", () => {
  it("defaults OFF and sends no requests", async () => {
    const provider = createOllamaLocalProvider();
    expect(provider.enabled).toBe(false);
    await expect(provider.generate(basic)).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(transport).not.toHaveBeenCalled();
  });
  it("pins loopback URL, fixed model, image cap, and no API key", async () => {
    transport.mockResolvedValue(Response.json({ message:{content:'{"notes":"rice"}'}, done:true, done_reason:"stop" }));
    const adapter = createOllamaLocalProvider(true);
    expect(adapter.capabilities).toMatchObject({text:true,vision:true,maxImages:1});
    expect(await adapter.generate({...basic, input:[...basic.input, image]})).toEqual({outputText:'{"notes":"rice"}'});
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe(OLLAMA_LOCAL_ENDPOINT);
    expect(options?.headers).toEqual({"Content-Type":"application/json"});
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe(OLLAMA_LOCAL_MODEL);
    expect(body.messages[1].images).toEqual([image.data]);
    expect(body.format).toEqual(basic.responseSchema);
    expect(options?.redirect).toBe("error");
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects two images, bad base64, and unsupported MIME before network", async () => {
    const provider = createOllamaLocalProvider(true);
    for (const input of [[...basic.input,image,image], [...basic.input,{...image,data:"bad!"}], [...basic.input,{...image,mimeType:"image/gif" as "image/png"}]]) {
      await expect(provider.generate({...basic,input})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects incomplete output and sanitizes HTTP errors without retries", async () => {
    const provider = createOllamaLocalProvider(true);
    transport.mockResolvedValueOnce(Response.json({message:{content:"{}"},done:false}));
    await expect(provider.generate(basic)).rejects.toThrow();
    transport.mockResolvedValueOnce(new Response("secret upstream content",{status:404}));
    const err = await provider.generate(basic).catch(e=>e);
    expect(err.status).toBe(404);
    expect(err.message).not.toContain("secret upstream");
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("never accepts a custom endpoint from input", () => {
    const body = JSON.parse(ollamaLocalBody(basic));
    expect(body).not.toHaveProperty("url");
    expect(body.messages[0].role).toBe("system");
  });
});