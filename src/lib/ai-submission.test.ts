import { afterEach, expect, it, vi } from "vitest";
import { submitAiRequest } from "./ai-submission";
afterEach(()=>vi.unstubAllGlobals());
it("retains a logical key across a bounded network retry",async()=>{
  const transport=vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(Response.json({ok:true}));
  vi.stubGlobal("fetch",transport);
  await submitAiRequest("/api/food/text",{method:"POST",body:"{}"},{idempotencyKey:"stable-request-key"});
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[0][1].headers.get("Idempotency-Key")).toBe("stable-request-key");
  expect(transport.mock.calls[1][1]).toBe(transport.mock.calls[0][1]);
});
it("does not retry HTTP errors or retry transport failures indefinitely",async()=>{
  const transport=vi.fn().mockResolvedValue(new Response("",{status:503}));
  vi.stubGlobal("fetch",transport);
  expect((await submitAiRequest("/api/food/text",{method:"POST"})).status).toBe(503);
  expect(transport).toHaveBeenCalledOnce();
  transport.mockReset().mockRejectedValue(new TypeError("offline"));
  await expect(submitAiRequest("/api/food/text",{method:"POST"})).rejects.toThrow("offline");
  expect(transport).toHaveBeenCalledTimes(2);
});
