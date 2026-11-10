import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, reserve, getProvider } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), getProvider: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("./provider", () => ({ getAiProvider: getProvider }));
import { POST as manual } from "@/app/api/food/text/route";
import { POST as coach } from "@/app/api/coach/chat/route";

const manualRequest = (model?: string) => new Request("http://localhost/api/food/text", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description: "100 g cooked rice", ...(model === undefined ? {} : { model }) }),
});
const coachRequest = (model: string) => new Request("http://localhost/api/coach/chat", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "How can I eat more fiber?", model, history: [], useSavedData: false }),
});

beforeEach(() => {
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  getProvider.mockReset();
});

describe("server-side strictly disjoint Vision and Text API rosters", () => {
  it.each(["gemini", "groq"])(
    "Manual AI Input rejects Vision provider %s before provider lookup or credits", async model => {
      const response = await manual(manualRequest(model));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNSUPPORTED" });
      expect(getProvider).not.toHaveBeenCalled();
      expect(reserve).not.toHaveBeenCalled();
    },
  );
  it.each(["gemini", "groq"])(
    "AURA rejects Vision provider %s before provider lookup or credits", async model => {
      const response = await coach(coachRequest(model));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNSUPPORTED" });
      expect(getProvider).not.toHaveBeenCalled();
      expect(reserve).not.toHaveBeenCalled();
    },
  );
  it("Manual AI Input rejects an omitted model (no hidden Gemini fallback)", async () => {
    const response = await manual(manualRequest());
    expect(response.status).toBe(422);
    expect(getProvider).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
  it.each(["cerebras", "siliconflow", "huggingface", "mistral", "ollama-local", "cloudflare", "openrouter", "zai"])(
    "Manual AI Input admits Text provider %s to availability check", async model => {
      const response = await manual(manualRequest(model));
      // No model is configured in this test: the request MUST reach the normal
      // provider availability gate and fail closed without charging credits.
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
      expect(getProvider).toHaveBeenCalledExactlyOnceWith(model);
      expect(reserve).not.toHaveBeenCalled();
    },
  );
  it.each(["cerebras", "siliconflow", "huggingface", "mistral", "ollama-local", "cloudflare", "openrouter", "zai"])(
    "AURA admits Text provider %s to availability check", async model => {
      const response = await coach(coachRequest(model));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
      expect(getProvider).toHaveBeenCalledExactlyOnceWith(model);
      expect(reserve).not.toHaveBeenCalled();
    },
  );
});