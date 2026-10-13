import { describe, expect, it } from "vitest";
import { createWeeklyReport, recentManilaDays } from "./weekly-report";

describe("seven-day nutrition report", () => {
  it("builds seven dates ending on the current Manila day", () => {
    const days=recentManilaDays(new Date("2026-10-13T17:30:00Z"));
    expect(days).toEqual(["2026-10-08","2026-10-09","2026-10-10","2026-10-11","2026-10-12","2026-10-13","2026-10-14"]);
  });
  it("groups UTC meal timestamps in Manila without inventing unknown macros", () => {
    const days=["2026-10-13","2026-10-14"];
    const report=createWeeklyReport([{
      id:"1",consumed_at:"2026-10-13T17:30:00Z",total_calories:410,total_protein:20,total_carbs:50,total_fat:10,
      analysis_snapshot:{foods:[{unknownMacros:["protein"]}]}
    }],days);
    expect(report[0]).toMatchObject({mealCount:0,calories:0});
    expect(report[1]).toMatchObject({mealCount:1,calories:410});
    expect(report[1].protein.incomplete).toBe(true);
  });
});
