import { describe, expect, it } from "vitest";
import { recommendedProviders, TEXT_SPECIALISTS } from "./provider-roles";
import { aiModelCatalog } from "./model-catalog";
import { isProviderAllowedForRole } from "./provider-role-policy";
describe("multi-purpose AI roles", () => {
  it("includes gated Vision pilots without exposing Text IDs to Photo Scanner", () => expect(recommendedProviders("photo")).toEqual(["gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision"]));
  it("includes all approved text candidates for coaching and manual entries", () => {
    const ids = new Set(recommendedProviders("coach"));
    for (const candidate of TEXT_SPECIALISTS) expect(ids.has(candidate)).toBe(true);
    expect(recommendedProviders("manual")).toContain("ollama-local");
  });
  it("does not misreport text-only candidates as vision capable", () => {
        for (const id of TEXT_SPECIALISTS) {
      const model = aiModelCatalog.find(entry => entry.id === id);
      expect(model).toBeDefined();
      expect(isProviderAllowedForRole(id, "vision")).toBe(false);
      expect(isProviderAllowedForRole(id, "text")).toBe(true);
      // Model may technically accept images while Khalories explicitly blocks scanner usage.
      expect(model?.text).toBe(true);
    }
  });
});