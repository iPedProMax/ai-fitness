import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveAuraTheme } from "@/components/appearance-boot";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("script-free root appearance initialization", () => {
  it("does not render raw scripts or Next.js Script in the React body", () => {
    expect(layout).toContain("<AppearanceBoot />");
    expect(layout).not.toMatch(/<script\b|<Script\b|dangerouslySetInnerHTML|next\/script/);
    expect(layout).toContain("<AppShell>{children}</AppShell>");
  });
  it("respects saved preference over system appearance", () => {
    expect(resolveAuraTheme("light", true)).toBe("light");
    expect(resolveAuraTheme("dark", false)).toBe("dark");
  });
  it("falls back to the operating system theme", () => {
    expect(resolveAuraTheme("system", true)).toBe("dark");
    expect(resolveAuraTheme(null, false)).toBe("light");
    expect(resolveAuraTheme("unexpected", true)).toBe("dark");
  });
});
