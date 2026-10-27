import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareProvider, CLOUDFLARE_TEXT_MODEL, CLOUDFLARE_MODEL } from "./cloudflare";
import { FOOD_DESCRIPTION_PREFIX } from "../food-description";
import { foodAnalysisSchema } from "@/lib/food-analysis";
import type { AiGenerationRequest } from "../types";

const fetchMock = vi.fn<typeof fetch>();
const credentials = { accountId: "a".repeat(32), apiToken: "test-cloudflare-key" };
const oats = { foods: [{ name: "Rolled oats", estimatedGrams: 70.6, calories: 268,
  protein: 9.2, carbs: 48, fat: 4.9, confidence: 0.8 }], totalCalories: 268,
  notes: "Visual estimate", clarifications: [] };
const request: AiGenerationRequest = { input: [
  { type: "text", text: "Analyze one food, JSON only." },
  { type: "text", text: `${FOOD_DESCRIPTION_PREFIX}"Quaker quick cook oats, tared"` },
  { type: "image", data: "AA==", mimeType: "image/jpeg" },
], responseSchema: { type: "object" } };

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("opt-in Cloudflare Scout vision experiment", () => {
  it("uses one Scout vision request with image and description", async () => {
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "scout");
    fetchMock.mockResolvedValue(Response.json({ success: true, result: { response: JSON.stringify(oats) } }));
    const result = await createCloudflareProvider(credentials, true).generate(request);
    expect(JSON.parse(result.outputText!)).toEqual(oats);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(CLOUDFLARE_TEXT_MODEL);
    const body = JSON.parse(init!.body as string);
    expect(body.stream).toBe(false);
    expect(body.messages[0].content[0].text).toContain("Quaker quick cook oats, tared");
    expect(body.messages[0].content[1]).toEqual({ type: "image_url",
      image_url: { url: "data:image/jpeg;base64,AA==" } });
  });
  it("uses existing Moondream by default and never switches automatically", async () => {
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "");
    fetchMock.mockResolvedValue(Response.json({ success: true, result: { result: {
      answer: JSON.stringify(oats), finish_reason: "stop" } } }));
    const result = await createCloudflareProvider(credentials, true).generate(request);
    expect(JSON.parse(result.outputText!).foods[0].calories).toBe(268);
    expect(String(fetchMock.mock.calls[0][0])).toContain(CLOUDFLARE_MODEL);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("fails safely on Scout HTTP errors with no silent fallback", async () => {
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "scout");
    fetchMock.mockResolvedValue(new Response("UPSTREAM PRIVATE RESPONSE", { status: 400 }));
    const error = await createCloudflareProvider(credentials, true).generate(request).catch(e => e);
    expect(error.message).not.toContain("UPSTREAM PRIVATE RESPONSE");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("rejects malformed Scout JSON instead of returning an invented estimate", async () => {
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "scout");
    fetchMock.mockResolvedValue(Response.json({ success: true, result: { response: "Not valid JSON" } }));
    await expect(createCloudflareProvider(credentials, true).generate(request))
      .rejects.toThrow("Cloudflare returned invalid JSON.");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not invent missing macros when Scout returns incomplete JSON", async () => {
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "scout");
    const incomplete = { foods: [{ name: "Oats", estimatedGrams: 70.6,
      calories: 268, protein: 9.2, carbs: 48, confidence: 0.8 }],
      totalCalories: 268, notes: "Uncertain estimate", clarifications: [] };
    fetchMock.mockResolvedValue(Response.json({ success: true, result: { response: JSON.stringify(incomplete) } }));
    const result = await createCloudflareProvider(credentials, true).generate(request);
    const parsed = JSON.parse(result.outputText!);
    expect(parsed.foods[0]).not.toHaveProperty("fat");
    // The canonical photo API validates this schema and fails closed.
    expect(foodAnalysisSchema.safeParse(parsed).success).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
