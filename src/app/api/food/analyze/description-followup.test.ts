import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, reserve, getProvider, generate } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), getProvider: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("@/lib/ai/provider", () => ({ getAiProvider: getProvider }));
import { POST } from "./route";

const oats = { foods: [{ name: "Plain Rolled Oats (Dried)", estimatedGrams: 71,
  calories: 247, protein: 8.3, carbs: 42.5, fat: 2.5, confidence: 0.85,
  scaleReadingGrams: 70.6, weightSource: "AI_ESTIMATE",
  brandStatus: "UNKNOWN_RELEVANT", varietyStatus: "UNKNOWN_RELEVANT" }],
  totalCalories: 247, notes: "Visual estimate", clarifications: [] };
function request(description: string) {
  const body = new FormData();
  body.set("model", "groq");
  body.set("description", description);
  body.append("images", new File(["oats"], "oats.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/food/analyze", { method: "POST", body });
}
beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({ outputText: JSON.stringify(oats) });
  getProvider.mockReset().mockReturnValue({ id: "groq", enabled: true, available: true,
    capabilities: { text: true, vision: true, maxImages: 2, structuredJson: true }, generate });
});

describe("optional user description resolves answered followups", () => {
  it("does not ask Groq brand, variety or tare again when explicitly provided", async () => {
    const response = await POST(request("quaker oats instant oats and yes its tared"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clarifications.map((q: { id: string }) => q.id)).not.toContain("tare_status_0");
    expect(body.clarifications.map((q: { id: string }) => q.id)).not.toContain("brand_0");
    expect(body.clarifications.map((q: { id: string }) => q.id)).not.toContain("variety_0");
    expect(body.foods[0].weightSource).toBe("SCALE_MEASURED");
    expect(body.foods[0].estimatedGrams).toBe(70.6);
    expect(body.totalCalories).toBe(body.foods[0].calories);
    expect(generate).toHaveBeenCalledOnce();
    expect(reserve).toHaveBeenCalledExactlyOnceWith("analysis");
  });
  it("keeps tare question when text states grams but not confirmation", async () => {
    const response = await POST(request("Quaker instant oats, 70.6 grams"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clarifications.map((q: { id: string }) => q.id)).toContain("tare_status_0");
    expect(body.foods[0].weightSource).toBe("AI_ESTIMATE");
  });
});
