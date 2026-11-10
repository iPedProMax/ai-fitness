import { afterEach, describe, expect, it, vi } from "vitest";
import { VISION_AI_PROVIDERS, isProviderAllowedForRole } from "./provider-role-policy";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";
import { getProviderMaxImages } from "./provider-image-limits";
import { aiModelCatalog } from "./model-catalog";

vi.mock("./free-gemini-policy", () => ({
  readFreeGeminiPolicies: vi.fn(async () => new Map([
    ["cloudflare", { enabled: true, reason: null }],
  ])),
}));
import { getAiModelStatuses } from "./model-status";

afterEach(() => vi.unstubAllEnvs());
const pilotStatus = async () => (await getAiModelStatuses()).find(item => item.id === "cloudflare-vision");

describe("Q4.12A Cloudflare Moondream photo pilot (mocked, no network)", () => {
  it("uses a distinct scanner ID so Cloudflare Scout text keeps its original role", () => {
    expect(VISION_AI_PROVIDERS).toContain("cloudflare-vision");
    expect(isProviderAllowedForRole("cloudflare-vision", "vision")).toBe(true);
    expect(isProviderAllowedForRole("cloudflare-vision", "text")).toBe(false);
    expect(isProviderAllowedForRole("cloudflare", "vision")).toBe(false);
    expect(SHARED_TEXT_AI_PROVIDERS).toContain("cloudflare");
    expect(SHARED_TEXT_AI_PROVIDERS).not.toContain("cloudflare-vision");
    expect(getProviderMaxImages("cloudflare-vision")).toBe(1);
    expect(aiModelCatalog.find(item => item.id === "cloudflare-vision")).toMatchObject({
      text: false, vision: true, maxImages: 1,
    });
  });
  it("stays disabled despite valid Cloudflare credentials when pilot is not opted in", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_ENABLE_CLOUDFLARE_FREE", "true");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", "fake-test-token");
    vi.stubEnv("AI_ENABLE_CLOUDFLARE_VISION_PILOT", "false");
    expect((await pilotStatus())?.enabled).toBe(false);
  });
  it("advertises the pilot only when explicitly opted in and policy is approved", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_ENABLE_CLOUDFLARE_FREE", "true");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", "fake-test-token");
    vi.stubEnv("AI_ENABLE_CLOUDFLARE_VISION_PILOT", "true");
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "");
    expect((await pilotStatus())?.enabled).toBe(true);
    vi.stubEnv("AI_CLOUDFLARE_VISION_MODEL", "scout");
    expect((await pilotStatus())?.enabled).toBe(false);
  });
});
