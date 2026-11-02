import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
describe("Y1 admin authorization and data-boundary wiring", () => {
  it("authorizes only Supabase app metadata after auth getUser", () => {
    const src = read("./admin-access.ts");
    expect(src).toContain("client.auth.getUser()");
    expect(src).toContain("data.user.app_metadata");
    expect(src).toContain('khalories_role === "admin"');
    expect(src).not.toContain("user_metadata");
  });
  it("gates all privileged metrics even if called independently", () => {
    const src = read("./admin-metrics.ts");
    expect(src).toContain("await getAdminAccess()");
    expect(src).toContain("if (!access.isAdmin) throw");
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(src).toContain('head: true, count: "exact"');
  });
  it("does not render admin page to ordinary signed-in users", () => {
    const page = read("../app/admin/analytics/page.tsx");
    expect(page).toContain("if (!access.isAdmin) notFound()");
    expect(page).toContain("await readAdminSummary()");
    expect(page).toContain('dynamic = "force-dynamic"');
    expect(page).not.toContain("use client");
  });
  it("only offers the dashboard admin link after a role check", () => {
    const dashboard = read("../app/dashboard/page.tsx");
    const link = read("../components/admin-dashboard-link.tsx");
    expect(dashboard).toContain("<AdminDashboardLink />");
    expect(link).toContain("if (!access.isAdmin) return null");
    expect(link).toContain('href="/admin/analytics"');
  });
});
