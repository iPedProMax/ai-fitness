import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDashboardFoodInsights, isPotentiallyPurineRichFood, phFoodDayKey } from "./dashboard-food-insights";

const today = "2026-11-02";
function meal(foods: unknown[], consumed_at = "2026-11-02T08:20:00+08:00") {
  return { consumed_at, analysis_snapshot: { foods } };
}
function food(name: string, advancedNutrients?: unknown) { return { name, advancedNutrients }; }

describe("Dashboard food insights - non-diagnostic and based only on known data", () => {
  it("distinguishes missing nutrients from a real numeric zero", () => {
    const result = buildDashboardFoodInsights([meal([
      food("Milk", {addedSugarG: 0, sodiumMg: 0}), food("Banana")
    ])], today);
    expect(result.addedSugar).toEqual({ total:0, known:1, missing:1 });
    expect(result.sodium).toEqual({ total:0, known:1, missing:1 });
    expect(result.notices).toHaveLength(0);
  });
  it("shows 20 percent Daily Value reminders only for explicitly recorded nutrients", () => {
    const result = buildDashboardFoodInsights([meal([food("Packaged snack", {addedSugarG: 10, sodiumMg: 460})])], today);
    expect(result.notices.map(x=>x.id)).toContain("added_sugar_food");
    expect(result.notices.map(x=>x.id)).toContain("sodium_food");
  });
  it("does not call total sugar added sugar, even for 28g in a drink", () => {
    const result = buildDashboardFoodInsights([meal([food("Yogurt drink", {sugarG: 28})])], today);
    expect(result.notices.some(x=>x.id==="added_sugar_food")).toBe(false);
    expect(result.notices.find(x=>x.id==="total_sugar_context")?.description).toMatch(/naturally occurring/);
  });
  it("only gives general purine reminders for narrow, named food categories", () => {
    expect(isPotentiallyPurineRichFood("Chicken liver")).toBe(true);
    expect(isPotentiallyPurineRichFood("Sardines in tomato sauce")).toBe(true);
    expect(isPotentiallyPurineRichFood("Sardinas")).toBe(true);
    expect(isPotentiallyPurineRichFood("Boiled rice and egg")).toBe(false);
    expect(isPotentiallyPurineRichFood("Kidney beans")).toBe(false);
    const result = buildDashboardFoodInsights([meal([food("Sardines")])], today);
    expect(result.notices.find(x=>x.id==="purine")?.description).toMatch(/cannot measure blood uric acid/);
  });
  it("uses Philippine calendar boundaries, not UTC server date", () => {
    expect(phFoodDayKey(new Date("2026-11-01T16:10:00Z"))).toBe("2026-11-02");
    const result = buildDashboardFoodInsights([
      meal([food("Liver")],"2026-11-01T15:59:00Z"),
      meal([food("Rice")],"2026-11-01T16:01:00Z"),
    ],today);
    expect(result.todayMeals).toBe(1);
    expect(result.notices).toHaveLength(0);
  });
  it("keeps malformed numbers, no food rows and old snapshots non-alarming", () => {
    const result = buildDashboardFoodInsights([
      meal([food("Soup",{sodiumMg:"1500",addedSugarG:-2})]),
      {consumed_at:"2026-11-02T11:30:00+08:00",analysis_snapshot:null},
    ], today);
    expect(result.sodium).toEqual({total:0,known:0,missing:1});
    expect(result.unknownFoodRows).toBe(1);
    expect(result.notices).toEqual([]);
  });
  it("shows general daily reference notices when recorded partial values cross the DV", () => {
    const result = buildDashboardFoodInsights([meal([food("Soup",{sodiumMg:2350,addedSugarG:51}),food("Unspecified")])],today);
    expect(result.notices.map(x=>x.id)).toContain("sodium_day");
    expect(result.notices.map(x=>x.id)).toContain("added_sugar_day");
    expect(result.notices.find(x=>x.id==="sodium_day")?.description).toMatch(/true total may be higher/);
  });
  it("is rendered only on the dashboard and queries the signed-in account", () => {
    const root = process.cwd();
    const page = readFileSync(join(root,"src/app/dashboard/page.tsx"),"utf8");
    const component = readFileSync(join(root,"src/components/dashboard-food-insights.tsx"),"utf8");
    expect(page).toContain("<DashboardFoodInsights />");
    expect(component).toContain('.eq("user_id", user.id)');
    expect(component).toContain("auth.getUser()");
    expect(component).not.toContain("service_role");
  });
});
