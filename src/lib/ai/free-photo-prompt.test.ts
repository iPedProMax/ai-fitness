import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { foodAnalysisJsonSchema } from "@/lib/food-analysis";
import { groqPhotoPrompt, cloudflarePhotoPrompt } from "./groq-photo-prompt";
import { readFileSync } from "node:fs";

const estimatedRequestBytes = (provider: "groq" | "cloudflare", photos: number) => {
  const input: Array<{ type: string; text?: string; mimeType?: string }> = [
    { type: "text", text: provider === "groq" ? groqPhotoPrompt : cloudflarePhotoPrompt },
    { type: "text", text: provider === "groq" ? `Photos: ${photos}.` : "One image. Use its visible evidence." },
  ];
  for (let i = 0; i < photos; i += 1) {
    input.push({ type: "text", text: provider === "groq" ? `Image ${i+1}/${photos}.` : "Inspect this photo as evidence; identify its role." });
    input.push({ type: "image", mimeType: "image/jpeg" });
  }
  return Buffer.byteLength(JSON.stringify({ input, responseSchema: foodAnalysisJsonSchema }), "utf8");
};

describe("Free vision provider prompt budgets", () => {
  it("fits all three Groq photo counts within the conservative 7800-token reservation", () => {
    for (const photos of [1, 2, 3]) {
      const reserved = Math.ceil(estimatedRequestBytes("groq", photos) / 3) + photos * 2048 + (photos === 3 ? 512 : 1024) + 256;
      expect(reserved).toBeLessThanOrEqual(7800);
    }
  });
  it("keeps a Cloudflare food scan within its conservative local token allowance", () => {
    const bytes = estimatedRequestBytes("cloudflare", 1);
    expect(Math.ceil(bytes * 1.25) + 1024 + 4096 + 2048).toBeLessThan(32768);
  });
  it("routes short photo prompts for both Free providers and exposes safe refinement errors", () => {
    const route = readFileSync("src/app/api/food/analyze/route.ts", "utf8");
    expect(route).toContain('provider.id === "cloudflare" ? cloudflarePhotoPrompt');
    expect(route).toContain('provider.id === "groq" ? `Image ${index + 1}/${images.length}.`');
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("error instanceof AiHttpError");
  });
});
