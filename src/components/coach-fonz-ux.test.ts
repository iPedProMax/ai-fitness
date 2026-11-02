import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const floating = readFileSync("src/components/aura-floating-coach.tsx", "utf8");
const full = readFileSync("src/app/coach/page.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
describe("Coach FONZ UI fixes", () => {
  it("uses the Text AI allowlist in the compact provider picker", () => {
    expect(floating).toContain("SHARED_TEXT_AI_PROVIDERS.some(");
    expect(floating).toContain('ollama-local');
    expect(floating).toContain('/api/coach/local');
  });
  it("clearly identifies both sides of a conversation", () => {
    expect(floating).toContain("data-fonz-speaker");
    expect(floating).toContain('["you", "user"].includes(String(');
    expect(css).toContain('[data-fonz-speaker="you"]');
    expect(css).toContain('[data-fonz-speaker="coach"]');
  });
  it("renames the assistant and clarifies free preset guidance", () => {
    expect(full).toContain("Coach FONZ");
    expect(full).toContain("Quick tips (no AI, no credits)");
    expect(full).not.toContain("â€”");
  });
  it("animates the real launcher with a reduced-motion fallback", () => {
    expect(floating).toContain('data-fonz-fab="true"');
    expect(css).toContain("khalories-fonz-visible-pulse");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
