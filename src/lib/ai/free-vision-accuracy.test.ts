import { afterEach, describe, expect, it, vi } from "vitest";
import { foodAnalysisJsonSchema, foodAnalysisSchema, type FoodAnalysis } from "@/lib/food-analysis";
import { createCloudflareProvider } from "@/lib/ai/providers/cloudflare";
import { groqPhotoPrompt } from "@/lib/ai/groq-photo-prompt";
import { ensureFreeProviderScaleClarifications } from "@/lib/ai/free-provider-scale";
import { normalizeScaleClarifications } from "@/lib/scale-clarification";

afterEach(() => { vi.unstubAllGlobals(); });

const oats: FoodAnalysis = {
  foods: [{ name: "Rolled oats", estimatedGrams: 70.6, calories: 270,
    protein: 9, carbs: 46, fat: 5, confidence: 0.65,
    scaleReadingGrams: 70.6, weightSource: "AI_ESTIMATE" }],
  totalCalories: 270, notes: "Tare is not confirmed.", clarifications: [],
};

describe("free vision evidence handling", () => {
  it("requests a tare confirmation when a provider supplies a readable scale weight", () => {
    const result = normalizeScaleClarifications(ensureFreeProviderScaleClarifications(oats));
    expect(result.clarifications).toEqual([expect.objectContaining({
      id: "tare_status_0", options: ["Yes", "No", "Not sure"]
    })]);
    expect(result.foods[0].scaleReadingGrams).toBe(70.6);
    expect(result.foods[0].weightSource).toBe("AI_ESTIMATE");
    expect(result.foods[0].calories).toBe(270);
  });
  it("never invents a scale reading, duplicate a tare question, or alter unmeasured nutrition", () => {
    const noReading = { ...oats, foods: [{ ...oats.foods[0], scaleReadingGrams: undefined }] };
    expect(ensureFreeProviderScaleClarifications(noReading)).toEqual(noReading);
    const first = ensureFreeProviderScaleClarifications(oats);
    expect(ensureFreeProviderScaleClarifications(first)).toEqual(first);
    expect(ensureFreeProviderScaleClarifications(oats).foods).toEqual(oats.foods);
  });
  it("makes free-provider prompts distinguish oats from rice without template nutrition values", async () => {
    expect(groqPhotoPrompt).toMatch(/rolled oats/i);
    expect(groqPhotoPrompt).toMatch(/rice/i);
    expect(groqPhotoPrompt).toMatch(/scaleReadingGrams/);
    const transport = vi.fn().mockResolvedValue(Response.json({ success: true, result: {
      result: { answer: JSON.stringify(oats), finish_reason: "stop" }
    }}));
    vi.stubGlobal("fetch", transport);
    const provider = createCloudflareProvider({ accountId: "a".repeat(32), apiToken: "synthetic-test-token" }, true);
    const result = await provider.generate({
      input: [{ type: "image", mimeType: "image/jpeg", data: "AA==" }],
      responseSchema: foodAnalysisJsonSchema,
    });
    const parsed = foodAnalysisSchema.parse(JSON.parse(result.outputText!));
    expect(parsed.foods[0].scaleReadingGrams).toBe(70.6);
    expect(parsed.foods[0].weightSource).toBe("AI_ESTIMATE");
    expect(parsed.foods[0].name).toBe("Rolled oats");
    const body = JSON.parse(transport.mock.calls[0][1].body as string);
    expect(body.question).toMatch(/rolled-oat flakes/i);
    expect(body.question).toMatch(/rice grains/i);
    expect(body.question).not.toContain('"estimatedGrams":200');
    expect(body.question).not.toContain('"calories":300');
    expect(body.question).not.toContain('"carbs":45');
  });
});
