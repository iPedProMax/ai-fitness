import { describe, expect, it } from "vitest";
import {
  activityCalories, activityInputSchema, activityTimeValid, manilaDayKey,
  type ActivityInput,
} from "./activity";

const example: ActivityInput = {
  activityType: "walking", intensity: "moderate", durationMinutes: 60,
  weightKg: 80, reportedCalories: null,
  performedAt: "2026-10-12T10:00:00.000Z", notes: "Treadmill",
};

describe("manual activity logging and calorie estimates", () => {
  it("estimates gross calories using duration, weight and MET intensity", () => {
    expect(activityCalories(example)).toEqual({ caloriesBurned: 294, calorieSource: "estimated" });
    const vigorous = activityCalories({ ...example, intensity: "vigorous" });
    expect(vigorous.caloriesBurned).toBeGreaterThan(294);
  });
  it("prefers a user-reported smartwatch value over an estimate", () => {
    expect(activityCalories({ ...example, reportedCalories: 360 })).toEqual({
      caloriesBurned: 360, calorieSource: "reported",
    });
    expect(activityCalories({ ...example, reportedCalories: 0 }).caloriesBurned).toBe(0);
  });
  it("does not invent calories without weight or a reported value", () => {
    expect(activityCalories({ ...example, weightKg: null })).toEqual({
      caloriesBurned: null, calorieSource: "not_estimated",
    });
  });
  it("validates activity types, realistic ranges and notes", () => {
    expect(activityInputSchema.safeParse(example).success).toBe(true);
    expect(activityInputSchema.safeParse({ ...example, durationMinutes: 0 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...example, weightKg: 0 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...example, reportedCalories: -1 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...example, activityType: "magic" }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...example, notes: "x".repeat(281) }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...example, user_id: "victim" }).success).toBe(false);
  });
  it("rejects future timestamps server-side", () => {
    const now = new Date("2026-10-13T12:00:00.000Z");
    expect(activityTimeValid("2026-10-13T12:00:00.000Z", now)).toBe(true);
    expect(activityTimeValid("2026-10-13T12:10:00.000Z", now)).toBe(false);
    expect(activityTimeValid("invalid", now)).toBe(false);
  });
  it("uses midnight in the Philippines rather than server-local midnight", () => {
    expect(manilaDayKey(new Date("2026-10-12T15:59:59Z"))).toBe("2026-10-12");
    expect(manilaDayKey(new Date("2026-10-12T16:00:00Z"))).toBe("2026-10-13");
  });
});
