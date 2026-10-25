import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGroqProvider, GROQ_MODEL } from "./groq";
import { isTransientProviderFailure } from "../errors";

const transport=vi.fn<typeof fetch>();
const request={input:[{type:"text" as const,text:"Exact existing prompt\n"}],responseSchema:{type:"object",properties:{notes:{type:"string"}},required:["notes"]}};
beforeEach(()=>{transport.mockReset();vi.stubGlobal("fetch",transport);});
afterEach(()=>vi.unstubAllGlobals());
describe("disabled Groq adapter (mock transport only)",()=>{
  it("is disabled by default and never sends credentials or traffic",async()=>{
    const provider=createGroqProvider("fake");
    expect(provider.enabled).toBe(false);
    expect(provider.capabilities).toEqual({text:true,vision:false,maxImages:0,structuredJson:true});
    await expect(provider.generate(request)).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
    expect(transport).not.toHaveBeenCalled();
  });
  it("preserves text and optional-field schema without strict-mode rewriting",async()=>{
    transport.mockResolvedValue(Response.json({choices:[{message:{content:'{"notes":"rice"}'},finish_reason:"stop"}]}));
    expect(await createGroqProvider("fake",true).generate(request)).toEqual({outputText:'{"notes":"rice"}'});
    const [url,init]=transport.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.parse(init!.body as string)).toEqual({model:GROQ_MODEL,messages:[{role:"user",content:request.input[0].text}],response_format:{type:"json_schema",json_schema:{name:"nutrition",strict:false,schema:request.responseSchema}},max_completion_tokens:2048});
    expect(init?.redirect).toBe("error"); expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects images before the transport even if called directly",async()=>{
    await expect(createGroqProvider("fake",true).generate({...request,input:[{type:"image",data:"AA==",mimeType:"image/png"}]})).rejects.toMatchObject({code:"NO_COMPATIBLE_PROVIDER"});
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
