import { describe, expect, it } from "vitest";
import { activityInputSchema } from "./activity";
import { filterActivityHistory, groupActivityHistoryByDay, WORKOUT_PRESETS, type ActivityHistoryRecord } from "./activity-history";

const now = new Date("2026-11-02T04:00:00Z");
const filters = { query: "", activityType: "all" as const, period: "all" as const };
function entry(id: string, time: string, type: ActivityHistoryRecord["activity_type"], notes = ""): ActivityHistoryRecord {
  return { id, performed_at: time, activity_type: type, intensity: "moderate", duration_minutes: 35, calories_burned: null, calorie_source: "not_estimated", notes };
}
const records = [
  entry("1", "2026-11-01T16:00:00Z", "walking", "Treadmill incline"),
  entry("2", "2026-10-26T15:59:59Z", "strength_training", "Upper body"),
  entry("3", "2026-10-03T15:59:59Z", "cycling", "Outdoor trail"),
];

describe("Phase W2 activity history and workout presets", () => {
  it("matches notes and activity labels without changing saved records", () => {
    expect(filterActivityHistory(records, { ...filters, query: "TREADMILL" }, now).map(a => a.id)).toEqual(["1"]);
    expect(filterActivityHistory(records, { ...filters, query: "Gym" }, now).map(a => a.id)).toEqual(["2"]);
    expect(filterActivityHistory(records, { ...filters, query: "trail" }, now).map(a => a.id)).toEqual(["3"]);
    expect(records).toHaveLength(3);
  });
  it("filters by activity type", () => {
    expect(filterActivityHistory(records, { ...filters, activityType: "walking" }, now).map(a => a.id)).toEqual(["1"]);
  });
  it("uses Philippine calendar days for seven-day window", () => {
    expect(filterActivityHistory(records, { ...filters, period: "7" }, now).map(a => a.id)).toEqual(["1"]);
  });
  it("uses Philippine calendar days for thirty-day window", () => {
    expect(filterActivityHistory(records, { ...filters, period: "30" }, now).map(a => a.id)).toEqual(["1", "2"]);
  });
  it("groups activities under Philippine calendar dates in reverse order", () => {
    const groups = groupActivityHistoryByDay([
      entry("a", "2026-11-01T15:59:00Z", "walking"),
      entry("b", "2026-11-01T16:01:00Z", "running"),
      entry("c", "2026-11-01T17:01:00Z", "walking"),
    ]);
    expect(groups.map(group => [group.date, group.entries.length])).toEqual([["2026-11-02", 2], ["2026-11-01", 1]]);
  });
  it("rejects invalid dates from grouping and filtering", () => {
    const invalid = entry("invalid", "broken", "walking");
    expect(groupActivityHistoryByDay([invalid])).toEqual([]);
    expect(filterActivityHistory([invalid], filters, now)).toEqual([]);
  });
  it("provides distinct, validated quick-fill workouts", () => {
    expect(new Set(WORKOUT_PRESETS.map(preset => preset.id)).size).toBe(WORKOUT_PRESETS.length);
    expect(WORKOUT_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of WORKOUT_PRESETS) {
      expect(activityInputSchema.safeParse({
        activityType: preset.activityType, intensity: preset.intensity, durationMinutes: preset.durationMinutes,
        weightKg: null, reportedCalories: null, performedAt: "2026-11-02T03:00:00.000Z", notes: "",
      }).success).toBe(true);
    }
  });
});