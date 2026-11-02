import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const component = readFileSync(new URL("./theme-toggle.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
describe("Khalories animated theme switch", () => {
  it("replaces the appearance dropdown with an accessible switch", () => {
    expect(component).toContain('role="switch"');
    expect(component).toContain("aria-checked={isDark}");
    expect(component).not.toContain("<select");
  });
  it("keeps the previous preference key and System behavior until clicked", () => {
    expect(component).toContain('"ai-fitness-appearance"');
    expect(component).toContain("appearance === \"system\" && systemDark");
    expect(component).toContain('media.addEventListener("change", onSystemChange)');
    expect(component).toContain("window.localStorage.setItem(STORAGE_KEY, next)");
  });
  it("animates the thumb and respects reduced motion", () => {
    expect(styles).toContain(".khalories-appearance-switch__thumb");
    expect(styles).toContain("cubic-bezier");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});
