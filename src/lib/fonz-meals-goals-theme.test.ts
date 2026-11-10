import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
describe("Khalories M2 scoped dark-mode legibility", () => {
  it("scopes the Meal History and Goals layouts", () => {
    expect(read("src/app/meals/page.tsx")).toContain("khalories-dark-meals");
    expect(read("src/app/goals/page.tsx")).toContain("khalories-dark-goals");
  });
  it("applies theme-only styling to both pages", () => {
    const css = read("src/app/globals.css");
    const block = css.split("/* Khalories M2: scoped dark-mode")[1];
    expect(block).toContain('html[data-aura-theme="dark"] .khalories-dark-meals');
    expect(block).toContain('html[data-aura-theme="dark"] .khalories-dark-goals');
    expect(block).toContain('section[aria-label="Find meals"]');
    expect(block).toContain('[aria-labelledby="recommended-title"]');
    expect(block).toContain('details.group > summary:hover');
  });
});