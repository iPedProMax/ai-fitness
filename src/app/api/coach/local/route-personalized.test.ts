import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, generate, loadSummary } = vi.hoisted(() => ({
  auth: vi.fn(), generate: vi.fn(), loadSummary: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/coach-user-context", () => ({ readCoachUserSummary: loadSummary }));
vi.mock("@/lib/ai/providers/ollama-local", () => ({
  OLLAMA_LOCAL_MODEL: "qwen2.5vl:3b",
  createOllamaLocalProvider: () => ({ generate }),
}));
import { POST } from "./route";
const summary = {
  asOfDay: "2026-10-30", today: {mealCount: 1, calories: 500, proteinGrams: 22, proteinIncomplete: false},
  past7Days: {daysWithMeals: 4, mealCount: 8, activitySessions: 2, activityMinutes: 120},
  goal: {type:"maintain", calories: 1900, proteinGrams: 120, targetWeightKg: null},
  latestWeight: null, recentFoodNames: ["Tinola"], limitedHistory: false,
};
function request(useSavedData = false, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/coach/local", {
    method: "POST", headers: { origin:"http://localhost:3000", "content-type":"application/json" },
    body: JSON.stringify({ model:"ollama-local", message:"Suggest a meal", useSavedData, ...extra }),
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AI_ENABLE_OLLAMA_LOCAL", "true");
  auth.mockReset().mockResolvedValue(null);
  generate.mockReset().mockResolvedValue({ outputText:'{"reply":"Try tinola with rice."}' });
  loadSummary.mockReset().mockResolvedValue(summary);
});
afterEach(() => vi.unstubAllEnvs());
describe("AURA personalized local route privacy boundaries", () => {
  it("does not access saved data without explicit opt-in", async () => {
    expect((await POST(request(false))).status).toBe(200);
    expect(loadSummary).not.toHaveBeenCalled();
    expect(generate.mock.calls[0][0].input[0].text).not.toContain("Tinola");
  });
  it("includes only the server-side snapshot after opt-in", async () => {
    expect((await POST(request(true))).status).toBe(200);
    expect(loadSummary).toHaveBeenCalledOnce();
    const prompt = generate.mock.calls[0][0].input[0].text as string;
    expect(prompt).toContain("Tinola");
    expect(prompt).toContain("untrusted JSON");
  });
  it("fails closed if the saved data cannot be loaded", async () => {
    loadSummary.mockResolvedValue(null);
    const result = await POST(request(true));
    expect(result.status).toBe(503);
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects forged client-provided records", async () => {
    expect((await POST(request(true, { userId:"someone-else", calories:999999 }))).status).toBe(400);
    expect(loadSummary).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
