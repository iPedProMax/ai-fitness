import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHARED_TEXT_AI_PROVIDERS } from "./shared-text-roster";

const coach = readFileSync(join(process.cwd(), "src/app/coach/page.tsx"), "utf8");
const picker = readFileSync(join(process.cwd(), "src/components/ai-provider-picker.tsx"), "utf8");

describe("Phase U6 approved text provider selection", () => {
  it("keeps Mistral in the Text AI roster, not the scanner", () => {
    expect(SHARED_TEXT_AI_PROVIDERS).toContain("mistral");
    expect(SHARED_TEXT_AI_PROVIDERS).not.toContain("gemini");
  });
  it("renders the full Coach FONZ dropdown from the entire shared roster", () => {
    expect(coach).toContain("SHARED_TEXT_AI_PROVIDERS.map(id =>");
    expect(coach).toContain('const enabled = available.has(id)');
    expect(coach).toContain("disabled={!enabled}");
    expect(coach).toContain("/api/coach/local");
    expect(coach).toContain("/api/coach/chat");
  });
  it("only auto-selects an enabled manual Text AI after statuses arrive", () => {
    expect(picker).toContain('const nextTextProvider = mode === "manual"');
    expect(picker).toContain("item.enabled === true && item.text === true");
    expect(picker).toContain("if (existing?.enabled === true && existing.text === true) return;");
    expect(picker).toContain("onChange(nextTextProvider)");
  });
});
