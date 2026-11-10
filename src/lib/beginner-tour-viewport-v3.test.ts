import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const src = readFileSync(join(process.cwd(), "src/components/beginner-tour.tsx"), "utf8");
describe("U11 V3 tutorial viewport regression", () => {
  it("anchors both body portals with inline fixed positioning", () => {
    expect(src).toContain('data-khalories-tour-overlay="intro" style={{ position: "fixed", inset: 0');
    expect(src).toContain('data-khalories-tour-overlay="spotlight" style={{ position: "fixed", inset: 0');
  });
  it("uses SVG arrows rather than corrupt UTF8 source characters", () => {
    expect(src).toContain('viewBox="0 0 24 24"');
    expect(src).toContain('cardDirection === "down"');
    expect(src).toContain("1F44B");
  });
  it("keeps coach tip above spotlight where there is room", () => {
    expect(src).toContain('hole.top - 18 - cardMaxHeight');
    expect(src).toContain('maxHeight: cardMaxHeight');
  });
  it("preserves tour actions and zero-credit replay", () => {
    expect(src).toContain('finish("skipped")');
    expect(src).toContain('beginnerTourSteps[stepIndex]');
    expect(src).toContain('router.push(step.path)');
  });
});
