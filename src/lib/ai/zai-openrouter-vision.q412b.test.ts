import { afterEach, describe, expect, it, vi } from "vitest";
import { VISION_AI_PROVIDERS, isProviderAllowedForRole } from "./provider-role-policy";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";
import { getProviderMaxImages } from "./provider-image-limits";
import { aiModelCatalog } from "./model-catalog";
import { getAiProvider } from "./provider";

vi.mock("./free-gemini-policy", () => ({
  readFreeGeminiPolicies: vi.fn(async () => new Map([
    ["zai", { enabled: true, reason: null }],
    ["openrouter", { enabled: true, reason: null }],
  ])),
}));
import { getAiModelStatuses } from "./model-status";

afterEach(() => vi.unstubAllEnvs());
const status = async (id: "zai-vision" | "openrouter-vision") =>
  (await getAiModelStatuses()).find(item => item.id === id);

function prepareCredentials() {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_ENABLE_ZAI_FREE", "true");
  vi.stubEnv("ZAI_ZERO_SPEND_CONFIRMED", "true");
  vi.stubEnv("ZAI_API_KEY", "fake-unit-test-key");
  vi.stubEnv("AI_ENABLE_OPENROUTER_FREE", "true");
  vi.stubEnv("OPENROUTER_FREE_ONLY_CONFIRMED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-unit-test-key");
}

describe("Q4.12B isolated Z.ai and OpenRouter Vision pilots (offline)", () => {
  it("preserves strict disjoint roles and existing photo counts", () => {
    expect(VISION_AI_PROVIDERS).toEqual([
      "gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision",
    ]);
    for (const [id, max] of [["zai-vision", 2], ["openrouter-vision", 1]] as const) {
      expect(isProviderAllowedForRole(id, "vision")).toBe(true);
      expect(isProviderAllowedForRole(id, "text")).toBe(false);
      expect(SHARED_TEXT_AI_PROVIDERS).not.toContain(id);
      expect(getProviderMaxImages(id)).toBe(max);
      expect(aiModelCatalog.find(entry => entry.id === id)).toMatchObject({ vision: true, text: false, maxImages: max });
    }
    for (const id of ["zai", "openrouter"]) {
      expect(isProviderAllowedForRole(id, "vision")).toBe(false);
      expect(isProviderAllowedForRole(id, "text")).toBe(true);
    }
  });
  it("fails closed with valid Text credentials but no Vision pilot opt-in", async () => {
    prepareCredentials();
    vi.stubEnv("AI_ENABLE_ZAI_VISION_PILOT", "false");
    vi.stubEnv("AI_ENABLE_OPENROUTER_VISION_PILOT", "false");
    expect((await status("zai-vision"))?.enabled).toBe(false);
    expect((await status("openrouter-vision"))?.enabled).toBe(false);
    expect(getAiProvider("zai-vision")).toBeNull();
    expect(getAiProvider("openrouter-vision")).toBeNull();
  });
  it("when explicitly opted in, shares original accounting IDs and maximum images", async () => {
    prepareCredentials();
    vi.stubEnv("AI_ENABLE_ZAI_VISION_PILOT", "true");
    vi.stubEnv("AI_ENABLE_OPENROUTER_VISION_PILOT", "true");
    expect((await status("zai-vision"))?.enabled).toBe(true);
    expect((await status("openrouter-vision"))?.enabled).toBe(true);
    const zai = getAiProvider("zai-vision");
    const openrouter = getAiProvider("openrouter-vision");
    expect(zai?.id).toBe("zai");
    expect(zai?.capabilities).toMatchObject({ vision: true, maxImages: 2 });
    expect(openrouter?.id).toBe("openrouter");
    expect(openrouter?.capabilities).toMatchObject({ vision: true, maxImages: 1 });
  });
  it("does not claim provider status without approved free-tier credentials", async () => {
    prepareCredentials();
    vi.stubEnv("AI_ENABLE_ZAI_VISION_PILOT", "true");
    vi.stubEnv("AI_ENABLE_OPENROUTER_VISION_PILOT", "true");
    vi.stubEnv("ZAI_ZERO_SPEND_CONFIRMED", "false");
    vi.stubEnv("OPENROUTER_FREE_ONLY_CONFIRMED", "false");
    expect((await status("zai-vision"))?.enabled).toBe(false);
    expect((await status("openrouter-vision"))?.enabled).toBe(false);
    expect(getAiProvider("zai-vision")).toBeNull();
    expect(getAiProvider("openrouter-vision")).toBeNull();
  });
});
