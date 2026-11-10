import { describe, it, expect } from "vitest";
import { VISION_AI_PROVIDERS, isProviderAllowedForRole } from "./provider-role-policy";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";
import { aiModelCatalog } from "./model-catalog";

describe("Q3 food-photo quality-first routing", () => {
  it("includes isolated, permission-gated experimental Vision scanner slots", () => {
    expect(VISION_AI_PROVIDERS).toEqual(["gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision"]);
  });
  it.each(["cloudflare", "openrouter", "zai"])("assigns %s to text only", id => {
    expect(isProviderAllowedForRole(id, "vision")).toBe(false);
    expect(isProviderAllowedForRole(id, "text")).toBe(true);
    expect(aiModelCatalog.find(item => item.id === id)?.text).toBe(true);
    expect(SHARED_TEXT_AI_PROVIDERS).toContain(id);
  });
  it("keeps the model rosters strictly disjoint and known to the catalog", () => {
    const ids = new Set(aiModelCatalog.map(item => item.id));
    expect(new Set([...VISION_AI_PROVIDERS, ...SHARED_TEXT_AI_PROVIDERS]).size)
      .toBe(VISION_AI_PROVIDERS.length + SHARED_TEXT_AI_PROVIDERS.length);
    for (const id of [...VISION_AI_PROVIDERS, ...SHARED_TEXT_AI_PROVIDERS]) expect(ids.has(id)).toBe(true);
  });
});
