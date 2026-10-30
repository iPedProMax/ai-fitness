import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./barcode-lookup.tsx", import.meta.url), "utf8");
describe("My Foods buttons have clear visual affordances", () => {
  for (const mode of ["selected", "manual"]) {
    it(`uses a filled accessible button for ${mode} nutrition`, () => {
      const index = source.indexOf(`onClick={()=>void rememberFood("${mode}")}`);
      expect(index).toBeGreaterThan(0);
      const action = source.slice(index, index + 680);
      expect(action).toContain("bg-emerald-700");
      expect(action).toContain("text-white");
      expect(action).toContain("min-h-11");
      expect(action).toContain("focus-visible:outline-2");
      expect(action).toContain('aria-hidden="true"');
      expect(action).toContain("disabled:cursor-not-allowed");
    });
  }
});