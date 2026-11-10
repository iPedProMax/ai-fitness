import { describe, expect, it } from "vitest";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

const vision = ["gemini", "groq", "cloudflare-vision", "zai-vision", "openrouter-vision"] as const;

describe("Khalories strict UI rosters", () => {
  it("never offers scanner providers for manual nutrition or AURA", () => {
    for (const provider of vision) expect(SHARED_TEXT_AI_PROVIDERS).not.toContain(provider);
  });
  it("contains only distinct, dedicated text-provider choices", () => {
    expect(SHARED_TEXT_AI_PROVIDERS).toEqual([
      "cerebras", "siliconflow", "huggingface", "mistral", "ollama-local",
      "cloudflare", "openrouter", "zai",
    ]);
    expect(new Set(SHARED_TEXT_AI_PROVIDERS).size).toBe(SHARED_TEXT_AI_PROVIDERS.length);
  });
});