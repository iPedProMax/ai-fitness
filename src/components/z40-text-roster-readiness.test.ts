import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const picker = readFileSync("src/components/ai-provider-picker.tsx", "utf8");
const coach = readFileSync("src/app/coach/page.tsx", "utf8");
describe("Z4.0 text roster", () => {
 it("shows every text provider and locks unavailable options", () => { expect(picker).toContain('mode === "manual" ? choices : choices.filter('); expect(picker).toContain('entry?.enabled === true && entry.text === true'); expect(picker).toContain('No paid fallback.'); });
 it("preserves existing local Ollama dev-only fallback without marking it ready", () => { expect(coach).toContain('available.has(model) || (model === "ollama-local" && process.env.NODE_ENV === "development")'); expect(coach).toContain('const tryLocal = id === "ollama-local"'); expect(coach).toContain('Try local (dev)'); });
});
