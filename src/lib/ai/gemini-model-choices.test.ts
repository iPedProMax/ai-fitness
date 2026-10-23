import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, generate } = vi.hoisted(() => ({ rpc: vi.fn(), generate: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {
  interactions = { create: generate };
} }));

import { readFreeGeminiPolicies } from "./free-gemini-policy";
import { getAiModelStatuses } from "./model-status";
import { createGeminiProvider } from "./providers/gemini";
import { getAiProvider } from "./provider";

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "not-a-real-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-role-key");
  rpc.mockReset(); generate.mockReset();
  rpc.mockResolvedValue({ data: [
    { id: "gemini", enabled: true, reason: null },
    { id: "gemini-3.8-flash", enabled: false, reason: "Application daily limit reached" },
    { id: "gemini-3.6-flash", enabled: true, reason: null },
  ], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("separate Gemini model choices", () => {
  it("exposes only verified local policy headroom, never invented Google balances", async () => {
    const statuses = await getAiModelStatuses();
    expect(statuses.find(s => s.id === "gemini")?.enabled).toBe(true);
    expect(statuses.find(s => s.id === "gemini-3.8-flash")).toMatchObject({
      enabled: false, reason: "Application daily limit reached",
    });
    expect(statuses.find(s => s.id === "gemini-3.6-flash")?.enabled).toBe(true);
    expect(JSON.stringify(statuses)).not.toContain("test-role-key");
  });

  it("fails closed for additional models when server policy cannot be read", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    const statuses = await getAiModelStatuses();
    expect(statuses.find(s => s.id === "gemini-3.6-flash")?.enabled).toBe(false);
    expect(statuses.find(s => s.id === "gemini")?.enabled).toBe(true); // original admission guard
  });

  it("accepts only allowlisted Gemini model names and uses distinct accounting identities", () => {
    expect(getAiProvider("gemini-3.8-flash")?.id).toBe("gemini-3.8-flash");
    expect(getAiProvider("gemini-3.6-flash")?.id).toBe("gemini-3.6-flash");
    expect(getAiProvider("gemini")?.id).toBe("gemini");
    expect(getAiProvider("gemini-3.8-flash-debug")).toBe(null);
  });

  it("sends the exact explicitly chosen SDK model, without fallback", async () => {
    generate.mockResolvedValue({ status: "completed", output_text: "{}" });
    const provider = createGeminiProvider("fake", "gemini-3.8-flash");
    await expect(provider.generate({ input: [{ type: "text", text: "Food" }], responseSchema: { type: "object" } }))
      .resolves.toEqual({ outputText: "{}" });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0]).toMatchObject({ model: "gemini-3.8-flash", store: false });
  });

  it("rejects malformed policy information rather than opening extra models", async () => {
    rpc.mockResolvedValue({ data: [{ id: "gemini-3.8-flash", enabled: "yes", reason: null }], error: null });
    expect((await readFreeGeminiPolicies()).size).toBe(0);
  });
});
