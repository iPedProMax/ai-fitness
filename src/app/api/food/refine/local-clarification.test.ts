// Route admission/accounting is mocked here; integration tests cover the real store.
import { describe, expect, it, vi } from "vitest";

const { reserveMock, selectMock } = vi.hoisted(() => ({
  reserveMock: vi.fn(async () => null),
  selectMock: vi.fn(async () => { throw new Error("AI must not run"); }),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: async () => null }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserveMock }));
vi.mock("@/lib/ai/selected-model", () => ({ selectRequestedAiModel: selectMock }));
vi.mock("@/lib/ai/request-control", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/ai/request-control")>(),
  guardProvider: (provider: import("@/lib/ai/types").AiProvider) => provider,
}));
import { POST } from "./route";

const base = {
  foods: [{ name: "Cooked white rice", estimatedGrams: 200, calories: 260,
    protein: 5.4, carbs: 57.2, fat: 0.6, confidence: 0.85,
    brandStatus: "UNKNOWN_RELEVANT", varietyStatus: "UNKNOWN_RELEVANT" }],
  totalCalories: 260,
  notes: "Visual estimate.",
  clarifications: [
    { id: "brand_0", foodIndex: 0, question: "Brand?", options: ["I don't know"], allowCustomAnswer: true },
    { id: "variety_0", foodIndex: 0, question: "Variety?", options: ["Jasmine rice", "I don't know"], allowCustomAnswer: true },
  ],
};
async function refine(clarificationId: string, answer: string) {
  return POST(new Request("http://localhost/api/food/refine", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ analysis: base, clarificationId, answer }),
  }));
}
describe("deterministic refinement without AI/cooldown", () => {
  it("dismisses unknown brand while keeping food nutrition and variety question", async () => {
    const res = await refine("brand_0", "I don't know");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.foods).toEqual(base.foods);
    expect(body.totalCalories).toBe(260);
    expect(body.clarifications.map((c: { id: string }) => c.id)).toEqual(["variety_0"]);
  });
  it("dismisses unknown variety without spending AI usage", async () => {
    const res = await refine("variety_0", "I don't know");
    expect(res.status).toBe(200);
    expect((await res.json()).totalCalories).toBe(260);
  });
  it("accepts plain brand metadata without changing calories", async () => {
    const res = await refine("brand_0", "Royal Umbrella");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.foods[0].brandStatus).toBe("KNOWN");
    expect(body.foods[0].calories).toBe(260);
    expect(body.foods[0].carbs).toBe(57.2);
  });
  it("does not run AI for the above cases", async () => {
    expect(reserveMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
  });
  it("rejects invalid option before attempting refinement", async () => {
    const res = await refine("variety_0", " ");
    expect(res.status).toBe(400);
  });
});
