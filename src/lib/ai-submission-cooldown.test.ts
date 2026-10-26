import { afterEach, describe, expect, it, vi } from "vitest";
import { foodApiError, parseRetryAfter } from "./ai-submission";
import { refineFoodAnalysis } from "./refine-food-analysis";
import { analyzeFood } from "./analyze-food";

afterEach(() => vi.restoreAllMocks());

describe("provider Retry-After cooldown handling", () => {
  it("parses only valid header durations and rejects invented wait times", () => {
    expect(parseRetryAfter("47")).toBe(47);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("0")).toBeUndefined();
    expect(parseRetryAfter("not-a-date")).toBeUndefined();
    expect(parseRetryAfter("9999999999999")).toBeUndefined();
  });

  it("only recognizes provider capacity errors, not quota or unrelated errors", () => {
    expect(foodApiError({code: "AI_PROVIDER_LIMITED", error: "Slow down"}, "fallback", "32")
      .retryAfterSeconds).toBe(32);
    expect(foodApiError({code: "AI_QUOTA_EXCEEDED", error: "Out of credits"}, "fallback", "32")
      .retryAfterSeconds).toBeUndefined();
    expect(foodApiError({code: "AI_PROVIDER_LIMITED", error: "Slow down"}, "fallback")
      .retryAfterSeconds).toBeUndefined();
  });

  it("propagates Retry-After from a failed food scan without retrying", async () => {
    const response = new Response(JSON.stringify({ code: "AI_PROVIDER_LIMITED", error: "Capacity exceeded" }), {
      status: 503, headers: { "Content-Type": "application/json", "Retry-After": "39" },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const image = new File(["meal"], "meal.jpg", { type: "image/jpeg" });
    await expect(analyzeFood({ images: [image] }, { modelId: "groq" }))
      .rejects.toMatchObject({ name: "AiHttpError", code: "AI_PROVIDER_LIMITED", retryAfterSeconds: 39 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("propagates Retry-After from a failed clarification without retrying", async () => {
    const response = new Response(JSON.stringify({ code: "AI_PROVIDER_LIMITED", error: "Capacity exceeded" }), {
      status: 503, headers: { "Content-Type": "application/json", "Retry-After": "42" },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    await expect(refineFoodAnalysis({foods: [], totalCalories: 0, notes: "", clarifications: []}, "portion", "2", {modelId: "groq"}))
      .rejects.toMatchObject({ name: "AiHttpError", code: "AI_PROVIDER_LIMITED", retryAfterSeconds: 42 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});