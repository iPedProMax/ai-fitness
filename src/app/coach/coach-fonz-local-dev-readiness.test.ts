import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("Coach FONZ full-page local dev readiness", () => {
  const page = readFileSync(join(process.cwd(), "src/app/coach/page.tsx"), "utf8");
  it("lets user attempt signed-in local Ollama in development even if status probe is unavailable", () => {
    expect(page).toContain('available.has(model) || (model === "ollama-local" && process.env.NODE_ENV === "development")');
  });
  it("still uses local guarded endpoint instead of cloud for Ollama", () => {
    expect(page).toContain('/api/coach/local');
    expect(page).toContain('/api/coach/chat');
  });
  it("preserves disabled cloud choices from server status", () => {
    expect(page).toContain('available.has(model)');
  });
});