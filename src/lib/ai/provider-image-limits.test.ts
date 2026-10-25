import { describe, expect, it } from "vitest";
import { getProviderMaxImages } from "./provider-image-limits";

describe("provider-dependent photo limits", () => {
  it("allows ten photos with Gemini", () => {
    expect(getProviderMaxImages("gemini")).toBe(10);
  });
  it("allows just one with the current Cloudflare adapter", () => {
    expect(getProviderMaxImages("cloudflare")).toBe(1);
  });
  it("keeps Groq text-only until its vision adapter is implemented", () => {
    expect(getProviderMaxImages("groq")).toBe(0);
  });
});
