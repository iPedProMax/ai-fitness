import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./request-control", () => ({ guardProvider: (provider: unknown) => provider }));
import { getAiProvider } from "./provider";

beforeEach(() => {
  vi.stubEnv("AI_ENABLE_CLOUDFLARE_FREE", "false");
  vi.stubEnv("AI_ENABLE_GROQ_FREE", "false");
  vi.stubEnv("GROQ_API_KEY", "test-key");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "abcdefabcdefabcdefabcdefabcdefab");
  vi.stubEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", "test-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("explicit Multi-AI provider opt-in", () => {
  it("does not activate optional providers from credentials alone", () => {
    expect(getAiProvider("groq")).toBeNull();
    expect(getAiProvider("cloudflare")).toBeNull();
  });
  it("allows the text-only Groq adapter only after explicit server opt-in", () => {
    vi.stubEnv("AI_ENABLE_GROQ_FREE", "true");
    expect(getAiProvider("groq")?.capabilities).toMatchObject({ text: true, vision: false, maxImages: 0 });
  });
  it("allows the single-image Cloudflare adapter only after explicit server opt-in", () => {
    vi.stubEnv("AI_ENABLE_CLOUDFLARE_FREE", "true");
    expect(getAiProvider("cloudflare")?.capabilities).toMatchObject({ vision: true, maxImages: 1 });
  });
  it("never accepts unapproved Gemini versions or invented providers", () => {
    expect(getAiProvider("gemini-3.8-flash")).toBeNull();
    expect(getAiProvider("arbitrary-user-model")).toBeNull();
  });
});
