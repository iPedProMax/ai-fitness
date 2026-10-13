import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync(
  new URL("./app-shell.tsx", import.meta.url),
  "utf8"
);

const rootLayout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8"
);

const dashboard = readFileSync(
  new URL("../app/dashboard/page.tsx", import.meta.url),
  "utf8"
);

describe("AI Fitness application shell", () => {
  it("mounts the shared shell in the root layout", () => {
    expect(rootLayout).toContain(
      "<AppShell>{children}</AppShell>"
    );
  });

  it("provides functioning scanner, dashboard and history routes", () => {
    expect(shell).toContain('href: "/dashboard"');
    expect(shell).toContain('href: "/"');
    expect(shell).toContain('href: "/meals"');
    expect(shell).toContain('href: "/activities"');
    expect(shell).toContain("aria-current=");
  });

  it("keeps auth and non-app routes outside the shell", () => {
    expect(shell).toContain("if (!isAppRoute)");
    expect(shell).toContain("return <>{children}</>");
  });

  it("has accessible mobile navigation", () => {
    expect(shell).toContain('aria-expanded={mobileOpen}');
    expect(shell).toContain('aria-controls="mobile-app-navigation"');
    expect(shell).toContain('onNavigate={() => setMobileOpen(false)}');
  });

  it("marks unfinished sections as upcoming instead of linking to missing pages", () => {
    expect(shell).toContain('label: "Daily Reports"');
    expect(shell).toContain('label: "Settings"');
    expect(shell).toContain('href: "/settings"');
    expect(shell).toContain("Coming soon".replace("Coming soon", "Soon"));
    expect(shell).toContain('aria-disabled="true"');
  });

  it("provides scanner and meal-history quick actions", () => {
    expect(dashboard).toContain('href="/"');
    expect(dashboard).toContain('href="/meals"');
    expect(dashboard).toContain("<TodayOverview />");
  });
});