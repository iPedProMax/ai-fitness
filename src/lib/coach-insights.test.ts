import { describe, expect, it } from "vitest";
import { coachDailyNudge, type CoachUserSummary } from "./coach-insights";
const basic: CoachUserSummary = {
  asOfDay: "2026-10-30", today: { mealCount: 1, calories: 800, proteinGrams: 55, proteinIncomplete: false },
  past7Days: { daysWithMeals: 3, mealCount: 6, activitySessions: 2, activityMinutes: 75 },
  goal: { type: "maintain", calories: 2000, proteinGrams: 110, targetWeightKg: null },
  latestWeight: null, recentFoodNames: ["Rice", "Eggs"], limitedHistory: false,
};
describe("nonclinical dashboard insights", () => {
  it("uses actual recorded protein against the saved goal", () => {
    expect(coachDailyNudge(basic)).toContain("55 g of protein");
    expect(coachDailyNudge(basic)).toContain("110 g target");
  });
  it("does not treat missing meals as fasting", () => {
    expect(coachDailyNudge({ ...basic, today: { ...basic.today, mealCount: 0 } })).toContain("No meals saved");
  });
  it("never claims the protein goal is met if macro values are incomplete", () => {
    expect(coachDailyNudge({ ...basic, today: { ...basic.today, proteinGrams: 150, proteinIncomplete: true } })).toContain("missing");
  });
  it("does not invent targets if the user has none", () => {
    expect(coachDailyNudge({ ...basic, goal: null })).toContain("Set a personal goal");
  });
  it("explicitly warns when the bounded query cuts off old rows", () => {
    expect(coachDailyNudge({ ...basic, limitedHistory: true })).toContain("not included");
  });
});
