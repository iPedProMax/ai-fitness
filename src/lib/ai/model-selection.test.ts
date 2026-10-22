import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, reserve, provider } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), provider: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("./provider", () => ({ getAiProvider: provider }));

import { POST as analyze } from "@/app/api/food/analyze/route";
import { POST as text } from "@/app/api/food/text/route";
import { POST as refine } from "@/app/api/food/refine/route";
import { GET as models } from "@/app/api/ai/models/route";
import { aiModelCatalog } from "./model-catalog";

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

describe("user-chosen AI model boundaries", () => {
  beforeEach(() => {
    auth.mockReset().mockResolvedValue(null);
    reserve.mockReset().mockResolvedValue(null);
    provider.mockReset().mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("shows all seven choices without exposing credentials or inventing free quota balances", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
    const response = await models();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.models).toHaveLength(7);
    expect(payload.models.map((m: {id:string}) => m.id)).toEqual(aiModelCatalog.map(m => m.id));
    expect(payload.models.find((m: {id:string}) => m.id === "gemini").enabled).toBe(true);
    expect(payload.models.filter((m: {id:string;enabled:boolean}) => m.id !== "gemini").every((m:{enabled:boolean})=>!m.enabled)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("synthetic-key");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not claim Gemini is available while AI_ENABLED=false", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
    const response = await models();
    expect((await response.json()).models.every((m:{enabled:boolean}) => !m.enabled)).toBe(true);
  });

  it.each([
    ["unknown", 400, "AI_INVALID_MODEL"],
    ["groq", 422, "AI_MODEL_UNSUPPORTED"],
    ["cloudflare", 503, "AI_MODEL_UNAVAILABLE"],
    ["openrouter", 503, "AI_MODEL_UNAVAILABLE"],
  ])("photo model %s fails safely, before consuming any credit", async (model, status, code) => {
    const response = await analyze(imageRequest(String(model)));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(reserve).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledTimes(model === "cloudflare" ? 1 : 0);
  });

  it("rejects a multi-photo request for the one-image Cloudflare adapter", async () => {
    const response = await analyze(imageRequest("cloudflare", 2));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNSUPPORTED" });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("does not auto-switch to Gemini when a selected text provider is disabled", async () => {
    const response = await text(textRequest("groq"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
    expect(provider).toHaveBeenCalledExactlyOnceWith("groq");
    expect(reserve).not.toHaveBeenCalled();
  });

  it("rejects unavailable models for AI clarifications before reserving refinement credits", async () => {
    const response = await refine(refineRequest("mistral"));
    expect(response.status).toBe(503);
    expect(reserve).not.toHaveBeenCalled();
  });
});
