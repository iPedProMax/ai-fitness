import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMistralBody, createMistralProvider } from "./providers/mistral";
import { mistralManualNutritionSchema } from "./mistral-manual-nutrition-schema";
import { foodAnalysisJsonSchema, foodAnalysisSchema } from "@/lib/food-analysis";

const makeRequest = () => ({
  input: [{ type: "text" as const, text: "200 g grilled chicken breast and 1 cup cooked white rice" }],
  responseSchema: foodAnalysisJsonSchema,
});

describe("Phase U9: Mistral Manual Text AI nutrition", () => {
  it("requests strict JSON nutrition with the fixed model and plain-text prompt", () => {
    const body = JSON.parse(buildMistralBody(makeRequest()));
    expect(body.model).toBe("ministral-14b-2512");
    expect(body.messages[0].content).toBe(makeRequest().input[0].text);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "manual_food_nutrition", strict: true,
        schema: mistralManualNutritionSchema,
      },
    });
    expect(body.max_tokens).toBe(1300);
  });
  it("requires all food fields expected by the existing server-side parser", () => {
    const format = JSON.parse(buildMistralBody(makeRequest())).response_format;
    expect(format.json_schema.schema.properties.foods.items.additionalProperties).toBe(false);
    expect(format.json_schema.schema.properties.foods.items.required).toEqual([
      "name", "estimatedGrams", "calories", "protein", "carbs", "fat", "confidence",
      "brandStatus", "varietyStatus", "materialUncertaintyPresent",
    ]);
    expect(format.json_schema.schema.properties.clarifications.items.required)
      .toEqual(["id", "foodIndex", "question", "options"]);
    const validSample = {
      foods: [{ name: "Cooked white rice", estimatedGrams: 100, calories: 130,
        protein: 2.7, carbs: 28.2, fat: 0.3, confidence: 0.65,
        brandStatus: "NOT_RELEVANT", varietyStatus: "NOT_RELEVANT",
        materialUncertaintyPresent: false }],
      totalCalories: 130, notes: "Approximation for cooked rice", clarifications: [],
    };
    expect(foodAnalysisSchema.safeParse(validSample).success).toBe(true);
  });
  it("does not alter Coach FONZ's validated reply format", () => {
    const body = JSON.parse(buildMistralBody({
      input: [{ type: "text", text: "Tell me about protein" }],
      responseSchema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] },
    }));
    expect(body.response_format.json_schema.name).toBe("coach_reply");
    expect(body.response_format.json_schema.schema.required).toEqual(["reply"]);
  });
  it("does not activate Mistral Vision or alter non-nutrition JSON requests", () => {
    const onePhoto = {
      input: [
        { type: "text" as const, text: "Look at the meal" },
        { type: "image" as const, mimeType: "image/jpeg" as const, data: "YWJjZA==" },
      ], responseSchema: foodAnalysisJsonSchema,
    };
    expect(JSON.parse(buildMistralBody(onePhoto)).response_format).toEqual({ type: "json_object" });
    const other = { input: [{ type: "text" as const, text: "Hello" }],
      responseSchema: { type: "object", required: ["foods"], properties: { foods: { type: "array" } } } };
    expect(JSON.parse(buildMistralBody(other)).response_format).toEqual({ type: "json_object" });
  });
  it("keeps API requests mocked: never contacts Mistral during validation", async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        foods: [{ name: "Cooked white rice", estimatedGrams: 100, calories: 130,
          protein: 2.7, carbs: 28.2, fat: 0.3, confidence: 0.65,
          brandStatus: "NOT_RELEVANT", varietyStatus: "NOT_RELEVANT",
          materialUncertaintyPresent: false }],
        totalCalories: 130, notes: "Estimated from food description", clarifications: [],
      }) } }],
    }));
    vi.stubGlobal("fetch", fakeFetch);
    try {
      const result = await createMistralProvider("dummy-key", true).generate(makeRequest());
      const parsed = foodAnalysisSchema.parse(JSON.parse(result.outputText ?? ""));
      expect(parsed.foods[0].calories).toBe(130);
      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
      expect(JSON.parse(String(init?.body)).response_format.type).toBe("json_schema");
    } finally { vi.unstubAllGlobals(); }
  });
});