import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, generate } = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai/providers/ollama-text-only", () => ({
  OLLAMA_TEXT_MODEL: "qwen2.5:3b",
  createOllamaTextProvider: () => ({ generate }),
}));
import { POST } from "@/app/api/food/text/local/route";

const result = {
  foods: [{ name: "Cooked rice", estimatedGrams: 100, calories: 130,
    protein: 3, carbs: 28, fat: 0.3, confidence: 0.7,
    brandStatus: "NOT_RELEVANT", varietyStatus: "NOT_RELEVANT", materialUncertaintyPresent: false }],
  totalCalories: 130, notes: "Approximate portion", clarifications: [],
};
function request(opts: { origin?: string; model?: string; text?: string; path?: string } = {}) {
  const origin = opts.origin === undefined ? "http://localhost:3000" : opts.origin;
  return new Request(opts.path ?? "http://localhost:3000/api/food/text/local", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ description: opts.text ?? "100 g cooked rice", model: opts.model ?? "ollama-local" }),
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AI_ENABLE_OLLAMA_LOCAL", "true");
  auth.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({ outputText: JSON.stringify(result) });
});

describe("local-only manual Text AI endpoint", () => {
  it.each([
    [75, 0.75],
    [85, 0.8],
    [100, 0.8],
  ])("accepts percent-style local confidence %s as fraction %s", async (rawScore, expected) => {
    generate.mockResolvedValueOnce({ outputText: JSON.stringify({
      ...result, foods: [{ ...result.foods[0], confidence: rawScore }],
    }) });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.foods[0].confidence).toBeCloseTo(expected);
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each([-5, 1.5, 120, "95%", null])(
    "rejects invalid or ambiguous confidence %s without manufacturing an estimate",
    async rawScore => {
      generate.mockResolvedValueOnce({ outputText: JSON.stringify({
        ...result, foods: [{ ...result.foods[0], confidence: rawScore }],
      }) });
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect(generate).toHaveBeenCalledOnce();
    },
  );

  it("rejects otherwise plausible food with malformed JSON", async () => {
    generate.mockResolvedValueOnce({ outputText: '{"foods":[{"name":"Rice"' });
    const response = await POST(request());
    expect(response.status).toBe(502);
  });

  it("accepts a local authenticated text estimate without a cloud provider", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ entryMethod: "TEXT_AI", totalCalories: 130,
      foods: [expect.objectContaining({ name: "Cooked rice", nutritionSource: "AI_ESTIMATE" })] });
    expect(generate).toHaveBeenCalledOnce();
  });
  it("rejects mismatched origin before provider dispatch", async () => {
    expect((await POST(request({ origin: "https://malicious.example" }))).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });
  it("never runs from a non-localhost app", async () => {
    expect((await POST(request({ path: "https://khalories.example/api/food/text/local" }))).status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
  it("fails closed when local dev flag is disabled", async () => {
    vi.stubEnv("AI_ENABLE_OLLAMA_LOCAL", "false");
    expect((await POST(request())).status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
  it("requires authenticated session", async () => {
    auth.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not accept Vision providers via the manual endpoint", async () => {
    expect((await POST(request({ model: "gemini" }))).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects missing nutrition JSON rather than presenting fabricated results", async () => {
    generate.mockResolvedValueOnce({ outputText: "not JSON" });
    expect((await POST(request())).status).toBe(502);
  });
  it("rejects serious macro contradictions", async () => {
    generate.mockResolvedValueOnce({ outputText: JSON.stringify({
      ...result, foods: [{ ...result.foods[0], calories: 450, carbs: 3, protein: 2, fat: 1 }],
    }) });
    expect((await POST(request())).status).toBe(502);
  });
});