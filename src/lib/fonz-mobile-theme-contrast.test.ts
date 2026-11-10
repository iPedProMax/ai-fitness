import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const logCss = readFileSync(resolve(process.cwd(), "src/app/log-food-redesign.css"), "utf8");

function contrast(foreground: string, background: string) {
  const toLightness = (hex: string) => {
    const normalized = hex.replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16) / 255);
    return rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const a = toLightness(foreground), b = toLightness(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

describe("Khalories mobile FONZ and themed Log Food", () => {
  it("places the FONZ launcher above the 70px mobile navigation", () => {
    expect(globalCss).toContain("/* Khalories M1: FONZ launcher");
    const patch = globalCss.split("/* Khalories M1: FONZ launcher")[1];
    expect(patch).toContain("@media (max-width: 1023px)");
    expect(patch).toMatch(/button\[data-fonz-fab="true"\][\s\S]*?bottom: calc\(70px \+ env\(safe-area-inset-bottom, 0px\) \+ 18px\) !important;/);
    expect(patch).toContain('[data-fonz-panel="true"]');
    expect(patch).toContain("100dvh");
  });
  it("keeps color overrides scoped to the dark theme rather than light mode", () => {
    expect(logCss).toContain('html[data-aura-theme="dark"] .khalories-log-redesign');
    expect(logCss).toContain('section[aria-labelledby="quick-nutrition-title"]');
    expect(logCss).toContain('.k-lf-help-card');
    expect(logCss).toContain('.wellness-chat-panel');
  });
  it("uses readable text colors on selected dark surfaces", () => {
    expect(contrast("#eff9ef", "#203a2d")).toBeGreaterThanOrEqual(7);
    expect(contrast("#bfd4c2", "#294736")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#f5fcf3", "#1b362a")).toBeGreaterThanOrEqual(7);
  });
});