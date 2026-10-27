import { beforeEach, describe, expect, it, vi } from "vitest";
import { FOOD_DESCRIPTION_PREFIX } from "@/lib/ai/food-description";

const { auth, reserve, getProvider, generate } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), getProvider: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("@/lib/ai/provider", () => ({ getAiProvider: getProvider }));

import { POST } from "./route";
const food = { foods: [{ name: "Rolled oats", estimatedGrams: 70.6,
  calories: 270, protein: 9, carbs: 46, fat: 5, confidence: 0.65 }],
  totalCalories: 270, notes: "Visual estimate", clarifications: [] };
function request(description?: string | File, model = "gemini") {
  const body = new FormData();
  body.append("images", new File(["image"], "oats.jpg", { type: "image/jpeg" }));
  body.append("model", model);
  if (description !== undefined) body.append("description", description);
  return new Request("http://localhost/api/food/analyze", { method: "POST", body });
}
beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({ outputText: JSON.stringify(food) });
  getProvider.mockReset().mockImplementation((id: string) => ({ id,
    enabled: true, available: true,
    capabilities: { text: true, vision: true, maxImages: id === "cloudflare" ? 1 : 10, structuredJson: true },
    generate,
  }));
});

describe("photo description travels with exactly one AI request", () => {
  it.each(["gemini", "groq", "cloudflare"])("sends optional context to %s once", async model => {
    const response = await POST(request("70.6 g dry Quaker oats; no milk", model));
    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
    const input = generate.mock.calls[0][0].input as Array<{ type: string; text?: string }>;
    expect(input.filter(part => part.type === "image")).toHaveLength(1);
    const context = input.filter(part => part.type === "text" && part.text?.startsWith(FOOD_DESCRIPTION_PREFIX));
    expect(context).toHaveLength(1);
    expect(context[0].text).toContain("70.6 g dry Quaker oats; no milk");
    expect(reserve).toHaveBeenCalledExactlyOnceWith("analysis");
  });
  it("leaves the legacy photo analysis unchanged without a description", async () => {
    expect((await POST(request())).status).toBe(200);
    const input = generate.mock.calls[0][0].input as Array<{ type: string; text?: string }>;
    expect(input.some(part => part.text?.startsWith(FOOD_DESCRIPTION_PREFIX))).toBe(false);
  });
  it("rejects an oversized description before reserving a credit", async () => {
    const response = await POST(request("x".repeat(401)));
    expect(response.status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects binary descriptions before reserving a credit", async () => {
    const response = await POST(request(new File(["bad"], "description.txt")));
    expect(response.status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
