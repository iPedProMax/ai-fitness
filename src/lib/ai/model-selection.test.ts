import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, reserve, provider } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), provider: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("./provider", () => ({ getAiProvider: provider }));

import { POST as analyze } from "@/app/api/food/analyze/route";
import { POST as text } from "@/app/api/food/text/route";
import { POST as refine } from "@/app/api/food/refine/route";
import { selectRequestedAiModel } from "./selected-model";

function imageRequest(model: string, count = 1) {
  const formData = new FormData();
  formData.set("model", model);
  for (let i = 0; i < count; i++) {
    formData.append("images", new File(["photo"], `pic${i}.jpg`, { type: "image/jpeg" }));
  }
  return new Request("http://localhost/api/food/analyze", { method: "POST", body: formData });
}
function textRequest(model: string) {
  return new Request("http://localhost/api/food/text", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "200 g cooked rice", model }),
  });
}
const food = { foods: [{ name: "Rice", estimatedGrams: 100, calories: 130,
  protein: 3, carbs: 28, fat: 0, confidence: 0.8 }], totalCalories: 130, notes: "", clarifications: [
  { id: "oil", foodIndex: 0, question: "Added oil?", options: ["Yes", "No"] },
] };
function refineRequest(model: string) {
  return new Request("http://localhost/api/food/refine", { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, analysis: food, clarificationId: "oil", answer: "Yes" }),
  });
}

const defaultProvider = {
  id: "gemini", enabled: true, available: true,
  capabilities: { text: true, vision: true, maxImages: 10, structuredJson: true },
  generate: vi.fn(),
};

beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  provider.mockReset().mockReturnValue(defaultProvider);
});

describe("single Gemini model admission", () => {
  it("uses the existing default when a request omits a model", async () => {
    const selection = await selectRequestedAiModel(undefined, 1);
    expect(selection).toMatchObject({ provider: defaultProvider });
    expect(provider).toHaveBeenCalledExactlyOnceWith("gemini");
  });

  it("allows explicitly supplied legacy default Gemini", async () => {
    const selection = await selectRequestedAiModel("gemini", 0);
    expect(selection).toMatchObject({ provider: defaultProvider });
    expect(provider).toHaveBeenCalledExactlyOnceWith("gemini");
  });

  it("rejects unknown model IDs before invoking any provider", async () => {
    const selection = await selectRequestedAiModel("unknown", 1);
    expect(selection.error?.status).toBe(400);
    expect(await selection.error?.json()).toMatchObject({ code: "AI_INVALID_MODEL" });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["gemini-3.8-flash", "gemini-3.6-flash", "openrouter"])(
    "blocks unsupported %s before using provider or credits", async model => {
      const response = await analyze(imageRequest(model));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "AI_INVALID_MODEL" });
      expect(provider).not.toHaveBeenCalled();
      expect(reserve).not.toHaveBeenCalled();
    },
  );

  it("blocks multi-photo requests for an old non-default model", async () => {
    const response = await analyze(imageRequest("cloudflare", 2));
    expect(response.status).toBe(422);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("rejects attempts to choose another model in text analyses", async () => {
    const response = await text(textRequest("gemini-3.8-flash"));
    expect(response.status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("rejects attempts to choose another model in refinements", async () => {
    const response = await refine(refineRequest("mistral"));
    expect(response.status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("accepts Cloudflare for one photo when available", async () => {
    provider.mockReturnValue({ ...defaultProvider, id: "cloudflare", capabilities: { ...defaultProvider.capabilities, maxImages: 1 } });
    expect(await selectRequestedAiModel("cloudflare", 1)).toMatchObject({ provider: { id: "cloudflare" } });
    expect(provider).toHaveBeenCalledExactlyOnceWith("cloudflare");
  });

  it("accepts Groq only for text", async () => {
    provider.mockReturnValue({ ...defaultProvider, id: "groq", capabilities: { ...defaultProvider.capabilities, vision: false, maxImages: 0 } });
    expect(await selectRequestedAiModel("groq", 0)).toMatchObject({ provider: { id: "groq" } });
    expect((await selectRequestedAiModel("groq", 1)).error?.status).toBe(422);
  });

  it("rejects excessive image counts with the normal compatibility error", async () => {
    const selection = await selectRequestedAiModel("gemini", 11);
    expect(selection.error?.status).toBe(422);
    expect(await selection.error?.json()).toMatchObject({ code: "AI_MODEL_UNSUPPORTED" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("fails closed if the configured default model is unavailable", async () => {
    provider.mockReturnValue(null);
    const selection = await selectRequestedAiModel(undefined, 1);
    expect(selection.error?.status).toBe(503);
    expect(await selection.error?.json()).toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
  });
});
