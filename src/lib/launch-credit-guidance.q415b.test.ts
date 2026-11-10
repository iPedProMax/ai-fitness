import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
const submit = readFileSync(join(process.cwd(), "src/lib/ai-submission.ts"), "utf8");

describe("Q4.15B failed scan credit transparency and recovery", () => {
  it("explains that attempted upstream scans might retain an AI credit", () => {
    expect(page).toContain("One analysis may use a daily credit after an AI provider is contacted");
    expect(page).toContain("If the provider was never contacted, Khalories refunds");
    expect(page).toContain("If it was contacted, the attempt may count");
  });
  it("offers a one-click no-credit fallback from a failed Khalories AI photo scan", () => {
    expect(page).toContain('entryMode === "photo" && photoMethod === "app"');
    expect(page).toContain('onClick={() => { setPhotoMethod("web"); resetAnalysis(); }}');
    expect(page).toContain("Switch to free AI Web Import");
  });
  it("keeps the existing credit balance refresh and same-key transport retry", () => {
    expect(submit).toContain('headers.set("Idempotency-Key", key)');
    expect(submit).toContain('window.dispatchEvent(new Event("khalories:ai-usage-changed"))');
  });
});
