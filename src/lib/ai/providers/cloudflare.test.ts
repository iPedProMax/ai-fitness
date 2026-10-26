import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { foodAnalysisJsonSchema, foodAnalysisSchema } from "@/lib/food-analysis";
import { createCloudflareProvider, getCloudflareProvider, CLOUDFLARE_MODEL } from "./cloudflare";
import { generateWithFallback, selectCompatibleProviders } from "../router";
import { isTransientProviderFailure } from "../errors";
import { getAiProvider } from "../provider";
import type { AiGenerationRequest, AiImageMimeType, AiProvider } from "../types";

const transport = vi.fn<typeof fetch>();
const credentials = { accountId: "a".repeat(32), apiToken: "synthetic-cloudflare-token" };
const food = { foods: [{ name: "Rice", estimatedGrams: 100, calories: 130, protein: 3, carbs: 28, fat: 0, confidence: 0.8 }], totalCalories: 130, notes: "", clarifications: [] };
const request: AiGenerationRequest = { input: [{ type: "text", text: "Exact food prompt\n" }, { type: "image", data: "AA==", mimeType: "image/jpeg" }], responseSchema: foodAnalysisJsonSchema };
const reply = (response: unknown = food) => Response.json({ success: true, result: { result: { answer: typeof response === "string" ? response : JSON.stringify(response), finish_reason: "stop" } } });
const textReply = (response: unknown = food) => Response.json({ success: true, result: { response } });
beforeEach(() => { transport.mockReset(); vi.stubGlobal("fetch", transport); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("disabled Cloudflare Workers AI adapter (mock HTTPS only)", () => {
  it("does not send traffic with credentials present unless explicitly enabled in server code", async () => {
    const provider = createCloudflareProvider(credentials);
    expect(provider).toMatchObject({ id: "cloudflare", enabled: false, available: true, capabilities: { text: true, vision: true, maxImages: 1, structuredJson: true } });
    expect(selectCompatibleProviders([provider], request)).toEqual([]);
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("keeps environment configuration server-only and disabled even with unrelated enable flags", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", credentials.accountId);
    vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", credentials.apiToken);
    vi.stubEnv("AI_ENABLED", "true"); vi.stubEnv("CLOUDFLARE_AI_ENABLED", "true");
    expect(getCloudflareProvider()).toMatchObject({ enabled: false, available: true });
    vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", ""); expect(getCloudflareProvider()).toBeNull();
    expect(transport).not.toHaveBeenCalled();
  });
  it("does not register Cloudflare as a live fallback just because its credentials exist", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", credentials.accountId);
    vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", credentials.apiToken);
    vi.stubEnv("GEMINI_API_KEY", "synthetic-gemini-key");
    expect(getAiProvider()?.id).toBe("gemini");
    vi.stubEnv("GEMINI_API_KEY", ""); expect(getAiProvider()).toBeNull();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["", "../../another/account", "https://example.com", "b".repeat(31)])("rejects unsafe account ID %j before transport", async accountId => {
    const provider = createCloudflareProvider({ ...credentials, accountId }, true);
    expect(provider.available).toBe(false);
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([food, JSON.stringify(food)])("preserves canonical nutrition from object or string JSON response", async result => {
    transport.mockResolvedValue(reply(result));
    const generated = await createCloudflareProvider(credentials, true).generate(request);
    expect(foodAnalysisSchema.parse(JSON.parse(generated.outputText!))).toMatchObject(food);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/ai/run/${CLOUDFLARE_MODEL}`);
    expect(init).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    expect(JSON.parse(init!.body as string)).toMatchObject({
      task: "query", image: "data:image/jpeg;base64,AA==", stream: false,
      reasoning: false, max_tokens: 900,
    });
    expect(transport).toHaveBeenCalledOnce();
  });
  it("accepts text tasks without injecting or rewriting prompts", async () => {
    transport.mockResolvedValue(textReply());
    await createCloudflareProvider(credentials, true).generate({ ...request, input: [{ type: "text", text: "Refine this exact answer\n" }] });
    expect(JSON.parse(transport.mock.calls[0][1]!.body as string).messages[0].content).toEqual([{ type: "text", text: "Refine this exact answer\n" }]);
    expect(transport.mock.calls[0][0]).toContain("llama-4-scout");
  });
  it("normalizes concise Moondream nutrition and caps unreliable confidence", async () => {
    transport.mockResolvedValue(reply({food_name:"Pasta",estimated_grams:200,calories_kcal:400,
      protein_g:20,carbs_g:40,fat_g:10,confidence:95,assumptions:"Portion is estimated."}));
    const result = await createCloudflareProvider(credentials, true).generate(request);
    const parsed = foodAnalysisSchema.parse(JSON.parse(result.outputText!));
    expect(parsed.foods).toHaveLength(1);
    expect(parsed.foods[0]).toMatchObject({name:"Pasta",estimatedGrams:200,calories:400,confidence:0.8,weightSource:"AI_ESTIMATE"});
  });
  it("rejects incomplete Moondream estimates instead of inventing missing macros", async () => {
    transport.mockResolvedValue(reply({food_name:"Unclear food",calories_kcal:400}));
    await expect(createCloudflareProvider(credentials,true).generate(request)).rejects.toThrow("Incomplete Moondream nutrition");
  });
  it("rejects multiple images without dropping evidence", async () => {
    const provider = createCloudflareProvider(credentials, true);
    const multiple = { ...request, input: [...request.input, request.input[1]] };
    expect(selectCompatibleProviders([provider], multiple)).toEqual([]);
    await expect(provider.generate(multiple)).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["https://example.com/image.jpg", "not base64!", ""])("rejects invalid image content %j before transport", async data => {
    await expect(createCloudflareProvider(credentials, true).generate({ ...request, input: [{ type: "image", mimeType: "image/jpeg", data }] })).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects oversized prompt/schema text before any request", async () => {
    await expect(createCloudflareProvider(credentials, true).generate({ ...request, input: [{ type: "text", text: "x".repeat(70_000) }] })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    await expect(createCloudflareProvider(credentials, true).generate({ ...request, responseSchema: { description: "x".repeat(70_000) } })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects unsupported image formats before transport", async () => {
    await expect(createCloudflareProvider(credentials, true).generate({ ...request,
      input: [{ type: "image", data: "AA==", mimeType: "image/gif" as AiImageMimeType }],
    })).rejects.toThrow("Invalid image input");
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects a body exceeding the application byte limit", async () => {
    await expect(createCloudflareProvider(credentials, true).generate({ ...request,
      input: [{ type: "image", data: "A".repeat(20 * 1024 * 1024 + 4), mimeType: "image/png" }],
    })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("aborts an in-progress body read on cancellation and cleans timers", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    transport.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) } as unknown as Response);
    const pending = createCloudflareProvider(credentials, true).generate({ ...request, signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    controller.abort(); await assertion;
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("sanitizes unknown transport errors and permits genuine network fallback", async () => {
    transport.mockRejectedValueOnce(new Error("SECRET"));
    const error = await createCloudflareProvider(credentials, true).generate(request).catch(error => error);
    expect(error.message).not.toContain("SECRET"); expect(isTransientProviderFailure(error)).toBe(false);
    transport.mockRejectedValueOnce(new TypeError("fetch failed"));
    const connection = await createCloudflareProvider(credentials, true).generate(request).catch(error => error);
    expect(isTransientProviderFailure(connection)).toBe(true);
  });
  it.each([400, 401, 403, 429, 503])("sanitizes HTTP %i and makes one attempt", async status => {
    transport.mockResolvedValue(new Response("SECRET UPSTREAM BODY", { status }));
    const error = await createCloudflareProvider(credentials, true).generate(request).catch(error => error);
    expect(error.message).not.toContain("SECRET"); expect(error.message).not.toContain(credentials.apiToken);
    expect(isTransientProviderFailure(error)).toBe([429, 503].includes(status));
    expect(transport).toHaveBeenCalledOnce();
  });
  it.each([null, "", "not JSON", "[]", { success: false, errors: [{ message: "SECRET" }] }])("rejects malformed/failed output without retries", async output => {
    transport.mockResolvedValue(output && typeof output === "object" && "success" in output ? Response.json(output) : reply(output));
    await expect(createCloudflareProvider(credentials, true).generate(request)).rejects.toThrow();
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects a truncated Moondream response", async () => {
    transport.mockResolvedValue(Response.json({success:true,result:{result:{answer:"{}",finish_reason:"length"}}}));
    await expect(createCloudflareProvider(credentials,true).generate(request)).rejects.toThrow("truncated");
  });
  it("bounds a hanging transport at 60 seconds and cleans up timers", async () => {
    vi.useFakeTimers(); transport.mockImplementation(() => new Promise(() => {}));
    const pending = createCloudflareProvider(credentials, true).generate(request);
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(60_000); await assertion;
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start a cancelled request", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createCloudflareProvider(credentials, true).generate({ ...request, signal: controller.signal })).rejects.toMatchObject({ code: "CANCELLED" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("allows mocked compatible fallback after an outage, with no adapter-owned credit calls", async () => {
    transport.mockResolvedValue(reply());
    const backup = createCloudflareProvider(credentials, true);
    const primary: AiProvider = { ...backup, id: "gemini", generate: vi.fn().mockRejectedValue({ status: 503 }) };
    expect(await generateWithFallback([primary, backup], request)).toMatchObject({ outputText: expect.any(String) });
    expect(primary.generate).toHaveBeenCalledOnce(); expect(transport).toHaveBeenCalledOnce();
  });
});
