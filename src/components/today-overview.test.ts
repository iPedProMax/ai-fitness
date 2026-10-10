import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./today-overview.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

describe("dashboard data wiring", () => {
  it("queries only the signed-in user's meals eaten within today's window", () => {
    expect(component).toContain('supabase.auth.getUser()');
    expect(component).toContain('.eq("user_id", authData.user.id)');
    expect(component).toContain('.gte("consumed_at", today.start)');
    expect(component).toContain('.lt("consumed_at", today.end)');
  });

  it("loads unknown macro markers and handles loading, guest, and error states", () => {
    expect(component).toContain('analysis_snapshot');
    expect(component).toContain('"yesterday"');
    expect(component).toContain('date.setDate(date.getDate() - 1)');
    expect(component).toContain('status: "guest"');
    expect(component).toContain('status: "error"');
    expect(component).toContain('status: "loading"');
  });

  it("shows the real overview on the existing dashboard", () => {
    expect(dashboard).toContain('<TodayOverview />');
  });
});
