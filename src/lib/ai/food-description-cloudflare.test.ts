import { afterEach, describe, expect, it, vi } from "vitest";
import { createCloudflareProvider } from "./providers/cloudflare";
import { formatFoodDescriptionContext } from "./food-description";
import { foodAnalysisJsonSchema } from "@/lib/food-analysis";

const creds = { accountId: "a".repeat(32), apiToken: "synthetic-token" };
const analysis = { foods: [{ name: "Oats", estimatedGrams: 70, calories: 270,
  protein: 9, carbs: 45, fat: 5, confidence: 0.7 }], totalCalories: 270,
  notes: "Estimate", clarifications: [] };
const transport = vi.fn<typeof fetch>();
afterEach(() => { vi.unstubAllGlobals(); transport.mockReset(); });

describe("Cloudflare vision description wiring", () => {
  it("adds user-supplied food context to Moondream question, never a second request", async () => {
    transport.mockResolvedValue(Response.json({ success: true, result: { result: {
      answer: JSON.stringify(analysis), finish_reason: "stop" } } }));
    vi.stubGlobal("fetch", transport);
    const provider = createCloudflareProvider(creds, true);
    const result = await provider.generate({ input: [
      { type: "text", text: "Existing app-generated food prompt" },
      { type: "text", text: formatFoodDescriptionContext("Quaker Quick Cook Oats") },
      { type: "image", data: "AA==", mimeType: "image/jpeg" },
    ], responseSchema: foodAnalysisJsonSchema });
    expect(result.outputText).toContain("Oats");
    expect(transport).toHaveBeenCalledOnce();
    const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
    expect(body.question).toContain("Quaker Quick Cook Oats");
    expect(body.question).toContain("unverified USER-SUPPLIED FOOD CONTEXT");
    expect(body.question).not.toContain("Existing app-generated food prompt");
  });
  it("does not append a description when omitted", async () => {
    transport.mockResolvedValue(Response.json({ success: true, result: { result: {
      answer: JSON.stringify(analysis), finish_reason: "stop" } } }));
    vi.stubGlobal("fetch", transport);
    await createCloudflareProvider(creds, true).generate({ input: [
      { type: "text", text: "Existing app prompt" },
      { type: "image", data: "AA==", mimeType: "image/jpeg" },
    ], responseSchema: foodAnalysisJsonSchema });
    const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
    expect(body.question).not.toContain("USER_FOOD_DESCRIPTION_CONTEXT");
  });
});
