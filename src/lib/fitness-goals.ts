import { z } from "zod";

export const FITNESS_GOALS = ["lose", "maintain", "gain"] as const;
export type FitnessGoal = (typeof FITNESS_GOALS)[number];

export const fitnessGoalInputSchema = z.object({
  goalType: z.enum(FITNESS_GOALS),
  calorieTarget: z.number().int().min(800).max(6000),
  proteinTarget: z.number().int().min(10).max(400),
  targetWeightKg: z.number().min(20).max(500).nullable(),
}).strict();

export type FitnessGoalInput = z.infer<typeof fitnessGoalInputSchema>;

export const weightEntryInputSchema = z.object({
  measuredOn: z.iso.date(),
  weightKg: z.number().min(20).max(500),
}).strict();

export type WeightEntryInput = z.infer<typeof weightEntryInputSchema>;

export function manilaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

/** Ensure a valid real calendar date, and not a future PH date. */
export function weightDateValid(date: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m &&
    parsed.getUTCDate() === d && date <= manilaDateKey(now) && date >= "2000-01-01";
}

export function targetProgress(consumed: number, target: number): {
  percent: number; displayPercent: number; difference: number;
} {
  const safeConsumed = Number.isFinite(consumed) ? Math.max(0, consumed) : 0;
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  return {
    percent: Math.min(100, (safeConsumed / safeTarget) * 100),
    displayPercent: Math.round((safeConsumed / safeTarget) * 100),
    difference: Math.round(safeTarget - safeConsumed),
  };
}

export const GOAL_LABELS: Record<FitnessGoal, string> = {
  lose: "Lose weight", maintain: "Maintain weight", gain: "Gain weight",
};
