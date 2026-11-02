import { describe, it, expect } from "vitest";
import { summarizeActivityWeek, type WeeklyActivityRecord } from "./activity-weekly-insights";

const now = new Date("2026-11-02T04:00:00Z");
function activity(performed_at: string, duration_minutes: number | string | null, calories_burned: number | string | null = null): WeeklyActivityRecord {
  return { performed_at, duration_minutes, calories_burned };
}

describe("Phase W1 Philippine-week activity overview", () => {
  it("includes seven calendar dates ending today in Philippine time", () => {
    const report = summarizeActivityWeek([], now);
    expect(report.days.map(day => day.date)).toEqual([
      "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
    ]);
  });
  it("groups sessions across the Philippine midnight boundary, not UTC", () => {
    const report = summarizeActivityWeek([
      activity("2026-11-01T15:59:59Z", 20),
      activity("2026-11-01T16:00:00Z", 30),
      activity("2026-11-02T01:00:00Z", 45),
    ], now);
    expect(report.days.at(-2)).toMatchObject({ sessions: 1, minutes: 20 });
    expect(report.days.at(-1)).toMatchObject({ sessions: 2, minutes: 75 });
    expect(report).toMatchObject({ sessions: 3, minutes: 95, activeLoggedDays: 2 });
  });
  it("excludes entries outside the last seven days", () => {
    const report = summarizeActivityWeek([activity("2026-10-26T00:00:00Z", 60)], now);
    expect(report.sessions).toBe(0);
    expect(report.minutes).toBe(0);
  });
  it("does not confuse missing burn with an explicitly reported zero", () => {
    const report = summarizeActivityWeek([
      activity("2026-11-02T02:00:00Z", 15, null),
      activity("2026-11-02T03:00:00Z", 30, 0),
      activity("2026-11-02T03:30:00Z", 40, 315),
    ], now);
    expect(report.knownCalories).toBe(315);
    expect(report.missingCalorieCount).toBe(1);
    expect(report.days.at(-1)).toMatchObject({ knownCalories: 315, missingCalorieCount: 1 });
  });
  it("supports numeric string values returned by the database", () => {
    const report = summarizeActivityWeek([activity("2026-11-02T03:00:00Z", "42", "123.5")], now);
    expect(report).toMatchObject({ minutes: 42, knownCalories: 123.5, missingCalorieCount: 0 });
  });
  it("does not let malformed timestamps or values poison totals", () => {
    const report = summarizeActivityWeek([
      activity("not-a-date", 100, 200),
      activity("2026-11-02T03:00:00Z", "bogus", "bogus"),
      activity("2026-11-02T04:00:00Z", -15, -100),
    ], now);
    expect(report).toMatchObject({ sessions: 2, minutes: 0, knownCalories: 0, missingCalorieCount: 2 });
    expect(Number.isFinite(report.minutes)).toBe(true);
  });
  it("does not mistake missing activity logs for confirmed rest days", () => {
    const report = summarizeActivityWeek([], now);
    expect(report.activeLoggedDays).toBe(0);
    expect(report.days.every(day => day.sessions === 0)).toBe(true);
  });
  it("does not mutate the incoming activity list", () => {
    const entry = Object.freeze(activity("2026-11-02T03:00:00Z", 50));
    const data = Object.freeze([entry]);
    expect(summarizeActivityWeek(data, now).minutes).toBe(50);
  });
});