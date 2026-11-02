import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ollamaTextBody, OLLAMA_TEXT_MODEL } from "./providers/ollama-text-only";

const coach = { input: [{ type: "text" as const, text: "What can I eat after a workout?" }],
  responseSchema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] } };
const nutrition = { input: [{ type: "text" as const, text: "100 g rice" }],
  responseSchema: { type: "object", properties: { foods: { type: "array" } }, required: ["foods"] } };

describe("Phase U7 dedicated local Ollama speed guard", () => {
  it("limits coach reply generation without modifying the response schema", () => {
    const result = JSON.parse(ollamaTextBody(coach));
    expect(result.model).toBe(OLLAMA_TEXT_MODEL);
    expect(result.model).toBe("qwen2.5:3b");
    expect(result.options.num_predict).toBe(480);
    expect(result.format).toEqual(coach.responseSchema);
    expect(result.stream).toBe(false);
  });
  it("keeps a larger budget for multi-item food nutrition JSON", () => {
    const result = JSON.parse(ollamaTextBody(nutrition));
    expect(result.options.num_predict).toBe(1800);
    expect(result.format).toEqual(nutrition.responseSchema);
  });
  it("keeps the local model loaded for follow-up questions", () => {
    expect(JSON.parse(ollamaTextBody(coach)).keep_alive).toBe("10m");
  });
  it("preserves local-only generation restrictions and never enables a cloud URL", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/ai/providers/ollama-text-only.ts"), "utf8");
    expect(source).toContain('http://127.0.0.1:11434/api/chat');
    expect(source).toContain('process.env.NODE_ENV === "development"');
    expect(source).toContain('request.input.some(part => part.type !== "text")');
  });
});