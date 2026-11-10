import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/settings/page.tsx", "utf8");
const profile = readFileSync("src/components/profile-personalization.tsx", "utf8");
const css = readFileSync("src/app/settings/settings-dark.css", "utf8");

function luminance(color: string) {
  const channels = color.slice(1).match(/.{2}/g)!.map(value => {
    const component = Number.parseInt(value, 16) / 255;
    return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Settings dark theme contrast regression", () => {
  it("only styles the Settings page when the dark appearance is enabled", () => {
    expect(page).toContain('import "./settings-dark.css"');
    expect(page).toContain("khalories-settings-root");
    expect(page).toContain("khalories-settings-hero");
    expect(profile).toContain("khalories-settings-avatar-panel");
    expect(css).toContain('html[data-aura-theme="dark"] .khalories-settings-root');
    expect(css).not.toMatch(/html\[data-aura-theme="light"\]/);
  });
  it("keeps main hero and avatar text at or above WCAG AA contrast", () => {
    for (const [text, surface] of [
      ["#f1fbf2", "#254639"],
      ["#cee0d0", "#254639"],
      ["#aef0ad", "#254639"],
      ["#e0f2df", "#304b3c"],
      ["#f3fbf4", "#284438"],
      ["#c3ddce", "#284438"],
      ["#ecfff0", "#345841"],
      ["#d0e2d5", "#263b31"],
      ["#f0fcf2", "#182f25"],
      ["#91ad9a", "#182f25"],
    ]) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps dark-mode inputs readable without changing light mode", () => {
    expect(css).toContain("button[aria-pressed=\"true\"]");
    expect(css).toContain("button[aria-pressed=\"false\"]");
    expect(css).toContain("input:not([type=\"file\"])");
    expect(css).toContain("textarea");
  });
});
