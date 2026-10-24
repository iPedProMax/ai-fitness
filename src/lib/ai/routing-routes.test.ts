import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { generateWithFallback } from "./router";
import type { AiGenerationRequest, AiProvider } from "./types";

const { auth, reserve, getProvider } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), getProvider: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("./provider", () => ({ getAiProvider: getProvider }));

import { POST as photo } from "@/app/api/food/analyze/route";
import { POST as text } from "@/app/api/food/text/route";
import { POST as refine } from "@/app/api/food/refine/route";

const analysis = {
  foods: [{ name: "Rice", estimatedGrams: 100, calories: 130,
    protein: 3, carbs: 28, fat: 0, confidence: 0.8 }],
  totalCalories: 130, notes: "", clarifications: [],
};
function photoRequest(count = 1) {
  const body = new FormData();
  for (let i = 0; i < count; i++) body.append("images", new File(["photo"], `${i}.jpg`, { type: "image/jpeg" }));
  return new Request("http://localhost/api/food/analyze", { method: "POST", body });
}
function textRequest(description = "100 g cooked rice") {
  return new Request("http://localhost/api/food/text", { method: "POST",
    body: JSON.stringify({ description, model: "gemini" }) });
}
function refineRequest() {
  return new Request("http://localhost/api/food/refine", { method: "POST", body: JSON.stringify({
    analysis: { ...analysis, clarifications: [{ id: "addition", foodIndex: 0, question: "Added oil?", options: ["Yes", "No"] }] },
    clarificationId: "addition", answer: "Yes",
  }) });
}
function mockProvider(id: string): AiProvider & { generate: ReturnType<typeof vi.fn<AiProvider["generate"]>> } {
  return { id, enabled: true, available: true,
    capabilities: { text: true, vision: true, maxImages: 10, structuredJson: true },
    generate: vi.fn<AiProvider["generate"]>(),
  };
}

beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  getProvider.mockReset();
});

const routes = [
  { label: "photo", handler: photo, request: () => photoRequest(), kind: "analysis" },
  { label: "text", handler: text, request: () => textRequest(), kind: "analysis" },
  { label: "refinement", handler: refine, request: refineRequest, kind: "refinement" },
] as const;

describe("route fallback credit and security boundaries (mocks only)", () => {
  for (const route of routes) {
    it(`${route.label} fallback succeeds with exactly one user credit and unchanged nutrition handling`, async () => {
      const primary = mockProvider("gemini");
      const backup = mockProvider("mock-backup");
      primary.generate.mockRejectedValue({ status: 503 });
      backup.generate.mockResolvedValue({ outputText: JSON.stringify(route.kind === "refinement" ? {
        updatedName: "Rice with oil", addedEstimatedGrams: 5, addedCalories: 45,
        addedProtein: 0, addedCarbs: 0, addedFat: 5, confidence: 0.8, notes: "Added oil", followUpClarifications: [],
      } : analysis) });
      getProvider.mockReturnValue({ ...primary, generate: (request: AiGenerationRequest) => generateWithFallback([primary, backup], request) });

      const response = await route.handler(route.request());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalCalories).toBe(route.kind === "refinement" ? 175 : 130);
      expect(data.foods[0].calories).toBe(route.kind === "refinement" ? 175 : 130);
      expect(reserve).toHaveBeenCalledExactlyOnceWith(route.kind);
      expect(primary.generate).toHaveBeenCalledOnce();
      expect(backup.generate).toHaveBeenCalledOnce();
      expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(primary.generate.mock.invocationCallOrder[0]);
      expect(backup.generate.mock.calls[0][0]).not.toHaveProperty("provider");
      expect(backup.generate.mock.calls[0][0]).not.toHaveProperty("model");
    });

    it(`${route.label} exhaustion stops before provider selection and fallback`, async () => {
      reserve.mockResolvedValue(NextResponse.json({ code: "AI_QUOTA_EXCEEDED" }, { status: 429 }));
      const primary = mockProvider("gemini");
      const backup = mockProvider("mock-backup");
      getProvider.mockReturnValue({ ...primary, generate: (request: AiGenerationRequest) => generateWithFallback([primary, backup], request) });
      expect((await route.handler(route.request())).status).toBe(429);
      expect(reserve).toHaveBeenCalledExactlyOnceWith(route.kind);
      expect(primary.generate).not.toHaveBeenCalled();
      expect(backup.generate).not.toHaveBeenCalled();
    });

    it(`${route.label} reports no compatible provider without leaking details`, async () => {
      const disabled = { ...mockProvider("disabled-secret-provider"), enabled: false };
      getProvider.mockReturnValue({ ...disabled, generate: (request: AiGenerationRequest) => generateWithFallback([disabled], request) });
      const response = await route.handler(route.request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "AI analysis is currently unavailable.", code: "AI_MODEL_UNAVAILABLE",
      });
      expect(disabled.generate).not.toHaveBeenCalled();
      expect(reserve).not.toHaveBeenCalled();
    });
  }

  it("rejects eleven photos and invalid text without reserving credits or calling a provider", async () => {
    expect((await photo(photoRequest(11))).status).toBe(400);
    expect((await text(textRequest(" "))).status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
    expect(getProvider).not.toHaveBeenCalled();
  });
});
