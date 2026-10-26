import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGroqProvider, GROQ_MODEL, groqCompletionTokens } from "./groq";
import { isTransientProviderFailure } from "../errors";
import type { AiGenerationRequest } from "../types";

const transport=vi.fn<typeof fetch>();
const request:AiGenerationRequest={input:[{type:"text",text:"Exact existing prompt\n"}],responseSchema:{type:"object",properties:{notes:{type:"string"}},required:["notes"]}};
const pic={type:"image" as const,data:"iVBORw0KGgo=",mimeType:"image/png" as const};
beforeEach(()=>{transport.mockReset();vi.stubGlobal("fetch",transport);});
afterEach(()=>vi.unstubAllGlobals());
const ok=()=>Response.json({choices:[{message:{content:'{"notes":"rice"}'},finish_reason:"stop"}]});

describe("Groq Qwen vision adapter (mock transport only)",()=>{
  it("defaults disabled, never sends credentials or traffic",async()=>{
    const provider=createGroqProvider("fake");
    expect(provider.enabled).toBe(false);
    expect(provider.capabilities).toEqual({text:true,vision:true,maxImages:2,structuredJson:true});
    await expect(provider.generate(request)).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(transport).not.toHaveBeenCalled();
  });
  it("sends text and schema to pinned vision model",async()=>{
    transport.mockResolvedValue(ok());
    expect(await createGroqProvider("fake",true).generate(request)).toEqual({outputText:'{"notes":"rice"}'});
    const [url,init]=transport.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.parse(init!.body as string)).toEqual({model:GROQ_MODEL,messages:[{role:"user",content:[{type:"text",text:request.input[0].type==="text"?request.input[0].text:""}]}],response_format:{type:"json_schema",json_schema:{name:"nutrition",strict:false,schema:request.responseSchema}},reasoning_effort:"none",max_completion_tokens:1024});
    expect(init?.redirect).toBe("error"); expect(transport).toHaveBeenCalledOnce();
  });
  it("sends two embedded images, not external links, in one request",async()=>{
    transport.mockResolvedValue(ok());
    await expect(createGroqProvider("fake",true).generate({...request,input:[...request.input,pic,pic]})).resolves.toHaveProperty("outputText");
    const body=JSON.parse(transport.mock.calls[0][1]!.body as string);
    expect(body.model).toBe(GROQ_MODEL);
    expect(body.messages[0].content).toHaveLength(3);
    expect(body.messages[0].content[1]).toEqual({type:"image_url",image_url:{url:"data:image/png;base64,iVBORw0KGgo="}});
    expect(body.max_completion_tokens).toBe(groqCompletionTokens(2));
    expect(body.response_format.json_schema.schema).toEqual(request.responseSchema);
    expect(groqCompletionTokens(2)).toBe(1024);
  });
  it("uses the full schema for both one and two images", async () => {
    // Return a fresh Response for each fetch; response bodies are single-use streams.
    transport.mockImplementation(async () => ok());
    for (const count of [1, 2]) {
      await createGroqProvider("fake", true).generate({...request, input: [...request.input, ...Array(count).fill(pic)]});
      const body = JSON.parse(transport.mock.calls.at(-1)![1]!.body as string);
      expect(body.response_format.json_schema.schema).toEqual(request.responseSchema);
    }
  });
  it("rejects three images, unsupported MIME and malformed base64 without network",async()=>{
    const adapter=createGroqProvider("fake",true);
    await expect(adapter.generate({...request,input:[...request.input,pic,pic,pic]})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    await expect(adapter.generate({...request,input:[...request.input,{...pic,mimeType:"image/gif" as "image/png"}]})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    await expect(adapter.generate({...request,input:[...request.input,{...pic,data:"bad!"}]})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([400,401,403,429,503])("sanitizes HTTP %i without hidden retries",async status=>{
    transport.mockResolvedValue(new Response("UPSTREAM SECRET",{status}));
    const error=await createGroqProvider("fake",true).generate(request).catch(error=>error);
    expect(error.message).not.toContain("SECRET");
    expect(isTransientProviderFailure(error)).toBe([429,503].includes(status));
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects truncated structured output",async()=>{
    transport.mockResolvedValue(Response.json({choices:[{message:{content:"{}"},finish_reason:"length"}]}));
    await expect(createGroqProvider("fake",true).generate(request)).rejects.toThrow("incomplete");
  });
});
