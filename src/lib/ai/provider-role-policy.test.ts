import { describe, expect, it } from "vitest";
import { VISION_AI_PROVIDERS, isProviderAllowedForRole } from "./provider-role-policy";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

describe("strict Khalories AI role allowlists", () => {
  it("never overlaps scanner and text providers", () => {
    expect(VISION_AI_PROVIDERS).toEqual(["gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision"]);
    expect(SHARED_TEXT_AI_PROVIDERS).toEqual(["cerebras", "siliconflow", "huggingface", "mistral", "ollama-local", "cloudflare", "openrouter", "zai"]);
    for (const id of VISION_AI_PROVIDERS) {
      expect(isProviderAllowedForRole(id, "vision")).toBe(true);
      expect(isProviderAllowedForRole(id, "text")).toBe(false);
    }
    for (const id of SHARED_TEXT_AI_PROVIDERS) {
      expect(isProviderAllowedForRole(id, "text")).toBe(true);
      expect(isProviderAllowedForRole(id, "vision")).toBe(false);
    }
  });
  it("rejects unknown IDs for either role", () => {
    expect(isProviderAllowedForRole("unknown", "vision")).toBe(false);
    expect(isProviderAllowedForRole("unknown", "text")).toBe(false);
  });
});