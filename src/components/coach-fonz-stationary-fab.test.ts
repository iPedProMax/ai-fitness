import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/app/globals.css', 'utf8');
const floating = readFileSync('src/components/aura-floating-coach.tsx', 'utf8');
describe('Coach FONZ stationary floating assistant launcher', () => {
  it('keeps the real floating button fixed at the same viewport edge', () => {
    expect(floating).toContain('data-fonz-fab="true"');
    const rule = css.match(/button\[data-fonz-fab="true"\]\s*\{[^}]*khalories-fonz-q-glow[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain('position: fixed !important');
    expect(rule).toContain('right: max(1.25rem');
    expect(rule).toContain('bottom: max(1.25rem');
    expect(rule).toContain('left: auto !important');
    expect(rule).toContain('transform: none !important');
  });
  it('pulses the halo without translating the button', () => {
    const glow = css.match(/@keyframes khalories-fonz-q-glow\s*\{[\s\S]*?\n\}/)?.[0];
    expect(glow).toContain('box-shadow:');
    expect(glow).not.toContain('translate');
    expect(glow).not.toContain('scale(');
    expect(css).toContain('khalories-fonz-q-ring');
    expect(css).toContain('khalories-fonz-q-glint');
  });
  it('disables animation for reduced-motion preferences', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{/);
    expect(css).toContain('button[data-fonz-fab="true"]::after { display: none; }');
  });
});
