import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Y2 AI analytics authorization and privacy", () => {
  it("refuses read access before querying trusted server-only tables", () => {
    const src = read("./admin-ai-metrics.ts");
    expect(src).toContain('import "server-only"');
    expect(src).toContain("await getAdminAccess()");
    expect(src).toContain('if (!access.isAdmin) throw new Error("Admin authorization required")');
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain('select("response_body');
    expect(src).not.toContain('select("user_id');
    expect(src).not.toContain('select("request_key');
  });
  it("requires an admin role inside the server route", () => {
    const src = read("../app/admin/analytics/ai/page.tsx");
    expect(src).toContain("if (!access.isAdmin) notFound()");
    expect(src).toContain("await readAdminAiSummary()");
    expect(src).toContain('dynamic = "force-dynamic"');
    expect(src).not.toContain("use client");
  });
  it("does not present historic accounting as live uptime or precise billed usage", () => {
    const src = read("../app/admin/analytics/ai/page.tsx");
    expect(src).toContain("not live provider health checks");
    expect(src).toContain("billing verification");
  });
});
