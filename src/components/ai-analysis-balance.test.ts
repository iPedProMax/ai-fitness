import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const balance = readFileSync(new URL("./ai-analysis-balance.tsx", import.meta.url), "utf8");
const submit = readFileSync(new URL("../lib/ai-submission.ts", import.meta.url), "utf8");

// A user may generate and discard an estimate without logging the meal.
// Only the trusted API tracks credits; the UI reads rather than mutates it.
describe("AI analysis balance does not depend on meal saving", () => {
  it("mounts a live balance in Log Food regardless of entry mode", () => {
    expect(page).toContain("<AiAnalysisBalance />");
    expect(balance).toContain('fetch("/api/ai/usage"');
    expect(balance).toContain('"khalories:ai-usage-changed"');
    expect(balance).not.toContain("saveMeal(");
  });
  it("triggers a fresh server balance read on every completed AI submission", () => {
    expect(submit).toContain('window.dispatchEvent(new Event("khalories:ai-usage-changed"))');
    expect(submit).toContain("Idempotency-Key");
  });
});
