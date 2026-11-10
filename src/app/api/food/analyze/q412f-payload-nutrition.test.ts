import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasImplausibleStarchyPhotoNutrition } from "@/lib/ai/nutrition-consistency";
import { freeTextBody } from "@/lib/ai/providers/free-text";

const { auth, reserve, select, generate } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), select: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("@/lib/ai/selected-model", () => ({ selectRequestedAiModel: select }));

import { POST } from "./route";

const regularRice = {
  foods: [{ name: "Rice", estimatedGrams: 70, calories: 90,
    protein: 2, carbs: 20, fat: 0.2, confidence: 0.75,
    brandStatus: "NOT_RELEVANT" as const, varietyStatus: "KNOWN" as const,
    materialUncertaintyPresent: false }],
  totalCalories: 90, notes: "visual estimate", clarifications: [],
};
const suspiciousRice = {
  foods: [{ ...regularRice.foods[0], estimatedGrams: 7, calories: 7,
    protein: 0, carbs: 0, fat: 0, confidence: 0.8 }],
  totalCalories: 7, notes: "visual estimate", clarifications: [],
};
function request(model: string) {
  const body = new FormData();
  body.append("images", new File(["photo"], "meal.jpg", { type: "image/jpeg" }));
  body.append("model", model);
  return new Request("http://localhost/api/food/analyze", { method: "POST", body });
}
beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({ outputText: JSON.stringify(regularRice) });
  select.mockReset().mockImplementation(async (id: string) => ({
    provider: {
      id: id === "openrouter-vision" ? "openrouter" : id === "zai-vision" ? "zai" : id === "cloudflare-vision" ? "cloudflare" : id,
      enabled: true, available: true,
      capabilities: { text: true, vision: true, maxImages: 2, structuredJson: true },
      generate,
    },
  }));
});

describe("Q4.12F compact Vision payload and nutrition sanity (mocked only)", () => {
  it.each([
    ["openrouter-vision", "openrouter"], ["zai-vision", "zai"],
  ] as const)("sends a compact, prevalidated payload to %s", async (model, providerId) => {
    const response = await POST(request(model));
    expect(response.status).toBe(200);
    expect(reserve).toHaveBeenCalledExactlyOnceWith("analysis");
    expect(generate).toHaveBeenCalledOnce();
    const input = generate.mock.calls[0][0].input;
    const outbound = JSON.parse(freeTextBody(providerId, { input,
      responseSchema: generate.mock.calls[0][0].responseSchema }));
    expect(outbound.messages[1].content.filter((part: { type: string }) => part.type === "image_url")).toHaveLength(1);
    expect(outbound.messages[1].content[0].text).toContain("Analyse exactly ONE food");
    expect(outbound.messages[1].content[0].text.length).toBeLessThan(16_000);
  });
  it("blocks 7 kcal rice with 0 g protein, carbs and fat instead of presenting it as valid", async () => {
    generate.mockResolvedValue({ outputText: JSON.stringify(suspiciousRice) });
    const response = await POST(request("cloudflare-vision"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "AI_NUTRITION_INCONSISTENT" });
    expect(reserve).toHaveBeenCalledOnce();
  });
  it("does not reject legitimate rice nutrition or zero-calorie water", () => {
    expect(hasImplausibleStarchyPhotoNutrition(regularRice.foods[0])).toBe(false);
    expect(hasImplausibleStarchyPhotoNutrition(suspiciousRice.foods[0])).toBe(true);
    expect(hasImplausibleStarchyPhotoNutrition({ ...suspiciousRice.foods[0], name: "Water", calories: 0 })).toBe(false);
  });
});
