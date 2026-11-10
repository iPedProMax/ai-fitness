import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const floating=readFileSync("src/components/aura-floating-coach.tsx","utf8");
const css=readFileSync("src/app/globals.css","utf8");
describe("Coach FONZ open popup layout",()=>{
  it("has independently identifiable launcher and chat panel",()=>{
    expect(floating).toContain('data-fonz-fab="true"');
    expect(floating).toContain('data-fonz-panel="true"');
  });
  it("reserves a different bottom slot for the chat above the launcher",()=>{
    const panel=css.match(/\[data-fonz-panel="true"\]\s*\{[^}]*\}/)?.[0];
    expect(panel).toContain("position: fixed !important");
    expect(panel).toContain("bottom: calc(max(1.25rem");
    expect(panel).toContain("+ 4.75rem");
    expect(panel).toContain("height: min(540px, calc(100dvh - 7rem))");
    const fab=css.match(/button\[data-fonz-fab="true"\]\s*\{[^}]*khalories-fonz-r2-bright-glow[^}]*\}/)?.[0];
    expect(fab).toContain("position: fixed !important");
    expect(fab).toContain("transform: none !important");
  });
  it("adds a visibly animated panel entrance and honors reduced motion",()=>{
    expect(css).toContain("@keyframes khalories-fonz-r2-panel-pop");
    expect(css).toContain("scale(.78)");
    expect(css).toContain("animation: khalories-fonz-r2-panel-pop 460ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
