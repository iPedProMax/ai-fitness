import { describe, expect, it } from "vitest";
import { fitnessGoalInputSchema, manilaDateKey, targetProgress, weightDateValid, weightEntryInputSchema } from "./fitness-goals";

describe("manual personal fitness goals", () => {
  it("accepts reasonable user-entered targets", () => {
    expect(fitnessGoalInputSchema.safeParse({ goalType:"maintain", calorieTarget:2000, proteinTarget:110, targetWeightKg:null }).success).toBe(true);
  });
  it("rejects unknown goals, invalid numeric inputs and unexpected keys", () => {
    expect(fitnessGoalInputSchema.safeParse({goalType:"crash",calorieTarget:2000,proteinTarget:100,targetWeightKg:null}).success).toBe(false);
    expect(fitnessGoalInputSchema.safeParse({goalType:"lose",calorieTarget:700,proteinTarget:100,targetWeightKg:null}).success).toBe(false);
    expect(fitnessGoalInputSchema.safeParse({goalType:"gain",calorieTarget:NaN,proteinTarget:80,targetWeightKg:null}).success).toBe(false);
    expect(fitnessGoalInputSchema.safeParse({goalType:"gain",calorieTarget:2500,proteinTarget:80,targetWeightKg:null,user_id:"attacker"}).success).toBe(false);
  });
  it("uses PH calendar date for check-ins and rejects future dates", () => {
    const now = new Date("2026-10-13T17:30:00Z");
    expect(manilaDateKey(now)).toBe("2026-10-14");
    expect(weightDateValid("2026-10-14",now)).toBe(true);
    expect(weightDateValid("2026-10-15",now)).toBe(false);
    expect(weightDateValid("2026-02-30",now)).toBe(false);
    expect(weightEntryInputSchema.safeParse({measuredOn:"2026-10-14",weightKg:82.5}).success).toBe(true);
    expect(weightEntryInputSchema.safeParse({measuredOn:"2026-10-14",weightKg:0}).success).toBe(false);
  });
  it("caps the progress bar while retaining above-target difference", () => {
    expect(targetProgress(2300,2000)).toMatchObject({percent:100,displayPercent:115,difference:-300});
  });
});
