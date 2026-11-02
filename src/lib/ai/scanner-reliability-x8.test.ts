import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GEMINI_LABEL_NUTRIENT_GUIDANCE, geminiLabelFoodAnalysisJsonSchema } from "./gemini-label-nutrients";
import { AiRoutingError, aiRoutingErrorResponse } from "./errors";

describe("X8 scanner request size and failure classification", () => {
  it("keeps optional nutrient guidance compact without losing evidence rules", () => {
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE.length).toBeLessThan(1450);
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("SAME serving");
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("Total sugar is NOT added sugar");
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("OMIT advancedNutrients entirely");
    expect(GEMINI_LABEL_NUTRIENT_GUIDANCE).toContain("do NOT estimate sodiumMg or addedSugarG");
    expect(geminiLabelFoodAnalysisJsonSchema.properties.foods.items.properties.advancedNutrients).toBeDefined();
  });
  it("still performs a single user-approved provider analysis request", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/food/analyze/route.ts"), "utf8");
    expect(route.match(/reserveAiUsage\("analysis"\)/g)).toHaveLength(1);
    expect(route).toContain("GEMINI_LABEL_NUTRIENT_GUIDANCE");
    expect(route).toContain("geminiLabelFoodAnalysisJsonSchema");
  });
  it("maps recognized timeout responses to a stable sanitized 504", async () => {
    for (const upstream of [{ status: 504, message: "private" },
        { status: 408, message: "private" }, { name: "RequestTimeoutError", message: "private" },
        { name: "APIConnectionTimeoutError", message: "private" }]) {
      const response = aiRoutingErrorResponse(upstream);
      expect(response?.status).toBe(504);
      expect(await response!.json()).toMatchObject({ code: "AI_TIMEOUT" });
      expect(response?.headers.get("Cache-Control")).toContain("no-store");
      expect(JSON.stringify(await aiRoutingErrorResponse(upstream)!.json())).not.toContain("private");
    }
  });
  it("preserves rate-limit and cancellation boundaries, no auto fallback", async () => {
    expect((await aiRoutingErrorResponse({ status: 429 })!.json()).code).toBe("AI_PROVIDER_LIMITED");
    expect(aiRoutingErrorResponse({ name: "AbortError" })).toBeNull();
    expect(aiRoutingErrorResponse(new Error("other failure"))).toBeNull();
    const response = aiRoutingErrorResponse(new AiRoutingError("TIMEOUT"));
    expect(response?.status).toBe(504);
  });
});
