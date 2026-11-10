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

it("refreshes usage after HTTP success, error, and retry without waiting for Add Meal", async () => {
  const dispatch = vi.fn();
  vi.stubGlobal("window", { dispatchEvent: dispatch });
  const transport = vi.fn()
    .mockResolvedValueOnce(Response.json({ foods: [] }))
    .mockResolvedValueOnce(new Response("", { status: 502 }))
    .mockRejectedValueOnce(new TypeError("transient network failure"))
    .mockResolvedValueOnce(Response.json({ foods: [] }));
  vi.stubGlobal("fetch", transport);
  await submitAiRequest("/api/food/text", { method: "POST", body: "{}" });
  await submitAiRequest("/api/food/text", { method: "POST", body: "{}" });
  await submitAiRequest("/api/food/text", { method: "POST", body: "{}" });
  expect(transport).toHaveBeenCalledTimes(4);
  expect(dispatch).toHaveBeenCalledTimes(3);
  for (const [event] of dispatch.mock.calls) expect(event.type).toBe("khalories:ai-usage-changed");
});