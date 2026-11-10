import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beginnerTourSteps } from "./beginner-tour";
const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
const component = readFileSync(join(process.cwd(), "src/components/beginner-tour.tsx"), "utf8");
describe("Phase U11 V4 AI Coach onboarding", () => {
  it("contains separate navigation, floating coach and full coach steps", () => {
    expect(beginnerTourSteps.map(s => s.id)).toEqual(["photo", "web-import", "barcode", "manual", "recipes", "meal-history", "coach-nav", "coach-floating", "coach", "reports", "activities", "settings"]);
    expect(beginnerTourSteps.find(s => s.id === "coach-nav")?.selector).toContain('/coach');
    expect(beginnerTourSteps.find(s => s.id === "coach-floating")?.selector).toContain('data-fonz-fab');
    expect(beginnerTourSteps.find(s => s.id === "coach")?.selector).toContain('coach-ai-provider');
  });
  it("retains explicit no-AI-request tour behavior and works with hidden mobile nav", () => {
    expect(component).toContain('querySelectorAll<HTMLElement>(step.selector)');
    expect(component).toContain('getClientRects().length > 0');
    expect(component).toContain('finish("skipped")');
    expect(component).toContain('router.push(step.path)');
  });
  it("keeps an AI Coach link in the sidebar navigation", () => {
    expect(shell).toMatch(/href\s*[:=]\s*["']\/coach["']/);
  });
});
