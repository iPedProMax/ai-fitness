import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeFoodText } from "./analyze-food-text";
afterEach(() => vi.unstubAllGlobals());
describe("text nutrition API client", () => {
  it("rejects empty descriptions before making requests", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeFoodText(" ")).rejects.toThrow(/3 to 600/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts valid structured estimates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ foods: [{ name: "rice", estimatedGrams: 200, calories: 260, protein: 5, carbs: 57, fat: 1, confidence: 0.7 }], totalCalories: 260, notes: "Estimated", clarifications: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeFoodText("200 g of cooked rice");
    expect(result.foods[0].name).toBe("rice");
    expect(fetchMock).toHaveBeenCalledWith("/api/food/text", expect.objectContaining({ method: "POST" }));
  });
});
