import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const profile = readFileSync("src/components/profile-personalization.tsx", "utf8");
const css = readFileSync("src/app/settings/settings-dark.css", "utf8");

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!;
  const [r, g, b] = channels.map((value) => {
    const normalized = Number.parseInt(value, 16) / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(first: string, second: string) {
  const x = luminance(first); const y = luminance(second);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("Settings avatar colors follow the rendered active theme", () => {
  it("does not retain a global background utility competing with the dark theme", () => {
    expect(profile).toContain("khalories-settings-avatar-panel");
    expect(profile).not.toContain("rounded-2xl bg-emerald-50 p-4");
    expect(profile).not.toContain("rounded-2xl bg-[#f4f9ef] p-4");
    expect(profile).toContain('backgroundColor: avatarIsDark ? "#284438" : "#f4f9ef"');
  });
  it("synchronizes the card to both the header theme switch and the Settings controls", () => {
    expect(profile).toContain('root.getAttribute("data-aura-theme") === "dark"');
    expect(profile).toContain("new MutationObserver(syncAvatarTheme)");
    expect(profile).toContain('attributeFilter: ["data-aura-theme"]');
    expect(profile).toContain("observer.disconnect()");
  });
  it("uses explicit readable colors for both name and email, without relying on inherited text", () => {
    expect(profile).toContain('color: avatarIsDark ? "#f3fbf4" : "#173221"');
    expect(profile).toContain('color: avatarIsDark ? "#c3ddce" : "#526758"');
    for (const [fg, bg] of [
      ["#f3fbf4", "#284438"], ["#c3ddce", "#284438"],
      ["#173221", "#f4f9ef"], ["#526758", "#f4f9ef"],
    ]) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("preserves private avatar upload, owner checks, and the scoped dark CSS", () => {
    expect(profile).toContain("safeAvatarPath(userId, avatarPath)");
    expect(profile).toContain("📷 Change photo");
    expect(css).toContain(".khalories-settings-root .khalories-settings-avatar-panel");
  });
});
