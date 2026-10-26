import { describe, expect, it } from "vitest";
import { calculateTdee } from "./tdee";

const base = {
  ageYears: 22,
  heightCm: 165,
  weightKg: 80,
  sex: "male" as const,
  activityLevel: "moderate" as const,
  goalType: "maintain" as const,
};

describe("adult TDEE calculator (no AI calls)", () => {
  it("calculates Mifflin–St Jeor BMR, TDEE and BMI", () => {
    const result = calculateTdee(base);
    expect(result.bmrCalories).toBe(1726);
    expect(result.maintenanceCalories).toBe(2676);
    expect(result.suggestedCalories).toBe(2680);
    expect(result.suggestedProteinGrams).toBe(96);
    expect(result.bmi).toBe(29.4);
  });

  it("suggests a modest reduction for weight loss without changing maintenance TDEE", () => {
    const result = calculateTdee({ ...base, goalType: "lose" });
    expect(result.maintenanceCalories).toBe(2676);
    expect(result.suggestedCalories).toBe(2430);
    expect(result.suggestedProteinGrams).toBe(112);
  });

  it("uses the other equation constant and recommends modest gain", () => {
    const result = calculateTdee({ ...base, sex: "female", activityLevel: "sedentary", goalType: "gain" });
    expect(result.bmrCalories).toBe(1560);
    expect(result.maintenanceCalories).toBe(1872);
    expect(result.suggestedCalories).toBe(2070);
  });

  it("does not automatically prescribe low calorie weight-loss targets", () => {
    const result = calculateTdee({ ...base, sex: "female", weightKg: 48, heightCm: 160, activityLevel: "sedentary", goalType: "lose" });
    expect(result.suggestedCalories).toBeNull();
    expect(result.caution).toMatch(/qualified professional/i);
  });

  it("does not automatically suggest weight loss for underweight BMI", () => {
    const result = calculateTdee({ ...base, weightKg: 46, heightCm: 170, activityLevel: "very", goalType: "lose" });
    expect(result.bmi).toBeLessThan(18.5);
    expect(result.suggestedCalories).toBeNull();
    expect(result.caution).toMatch(/BMI/);
  });

  it("rejects children, invalid input and unknown activity multipliers", () => {
    expect(() => calculateTdee({ ...base, ageYears: 17 })).toThrow(/18/);
    expect(() => calculateTdee({ ...base, weightKg: Number.NaN })).toThrow();
    expect(() => calculateTdee({ ...base, activityLevel: "hacker" as "moderate" })).toThrow();
    expect(() => calculateTdee({ ...base, heightCm: 0 })).toThrow();
  });
});
