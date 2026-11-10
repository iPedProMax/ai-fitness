import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const insight = readFileSync("src/components/coach-insight-card.tsx", "utf8");
const health = readFileSync("src/components/health-snapshot.tsx", "utf8");
const floating = readFileSync("src/components/aura-floating-coach.tsx", "utf8");
const coach = readFileSync("src/app/coach/page.tsx", "utf8");

describe("Coach FONZ user-facing branding", () => {
  it("labels the dashboard card and health snapshot as Coach FONZ", () => {
    expect(insight).toContain("COACH FONZ INSIGHT");
    expect(insight).toContain('aria-label="Coach FONZ daily insight"');
    expect(insight).not.toContain("AURA COACH INSIGHT");
    expect(health).toContain("Ask Coach FONZ");
    expect(health).toContain("inside Coach FONZ.");
    expect(health).not.toContain("Ask AURA");
  });
  it("uses FONZ in floating-coach labels, status and accessibility", () => {
    expect(floating).toContain("Quick Coach FONZ chat");
    expect(floating).toContain("Close Coach FONZ chat");
    expect(floating).toContain("Coach FONZ is temporarily unavailable.");
    expect(floating).toContain("Coach FONZ is thinking");
    expect(floating).not.toContain("Quick AURA coach chat");
    expect(floating).not.toContain("AURA is thinking");
    expect(floating).toContain('data-fonz-panel="true"');
  });
  it("uses matching initials on the full Coach FONZ page", () => {
    expect(coach).toContain(">FZ</div>");
    expect(coach).not.toContain(">AF</div>");
  });
});
