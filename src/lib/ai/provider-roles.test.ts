import { describe, expect, it } from "vitest";
import { recommendedProviders, TEXT_SPECIALISTS } from "./provider-roles";
import { aiModelCatalog } from "./model-catalog";
describe("multi-purpose AI roles", () => {
  it("prefers Gemini and Groq for photo tasks", () => expect(recommendedProviders("photo")).toEqual(["gemini", "groq"]));
  it("includes all approved text candidates for coaching and manual entries", () => {
    const ids = new Set(recommendedProviders("coach"));
    for (const candidate of TEXT_SPECIALISTS) expect(ids.has(candidate)).toBe(true);
    expect(recommendedProviders("manual")).toContain("ollama-local");
  });
  it("does not misreport text-only candidates as vision capable", () => {
    for (const id of TEXT_SPECIALISTS) expect(aiModelCatalog.find(model=>model.id===id)?.maxImages).toBe(0);
  });
});