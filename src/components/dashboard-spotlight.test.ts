import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const spotlight = readFileSync(new URL("./dashboard-spotlight.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

describe("dashboard decorative spotlight", () => {
  it("tracks the cursor locally without rerendering and never intercepts clicks", () => {
    expect(spotlight).toContain('"use client"');
    expect(spotlight).toContain("onPointerMove={handlePointerMove}");
    expect(spotlight).toContain("event.clientX - bounds.left");
    expect(spotlight).toContain("event.clientY - bounds.top");
    expect(spotlight).toContain("style.setProperty");
    expect(spotlight).toContain("pointer-events-none");
  });

  it("respects reduced motion and preserves dashboard content", () => {
    expect(spotlight).toContain("motion-reduce:hidden");
    expect(spotlight).toContain('event.pointerType === "touch"');
    expect(dashboard).toContain("<DashboardSpotlight>");
    expect(dashboard).toContain("<TodayOverview />");
    expect(dashboard).toContain('href="/meals"');
    expect(dashboard).toContain('href="/"');
    // The hero must not have a second, permanently lit decorative orb.
    expect(dashboard).not.toContain("-right-20 -top-28");
    expect(dashboard).not.toContain("bg-emerald-500/15");
  });
});
