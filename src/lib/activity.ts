import { z } from "zod";

export const ACTIVITY_TYPES = [
  "walking",
  "running",
  "cycling",
  "strength_training",
  "other",
] as const;

export const INTENSITIES = ["light", "moderate", "vigorous"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type Intensity = (typeof INTENSITIES)[number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  walking: "Walking",
  running: "Running",
  cycling: "Cycling",
  strength_training: "Gym / strength training",
  other: "Other activity",
};

// Approximate MET values. Actual energy expenditure varies with pace, technique,
// terrain, individual physiology and fitness. This is a gross-kcal estimate.
const MET: Record<ActivityType, Record<Intensity, number>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 4.3 },
  running: { light: 6, moderate: 8.3, vigorous: 11 },
  cycling: { light: 4, moderate: 6.8, vigorous: 10 },
  strength_training: { light: 2.5, moderate: 3.5, vigorous: 6 },
  other: { light: 2, moderate: 3.5, vigorous: 6 },
};

export const activityInputSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES),
  intensity: z.enum(INTENSITIES),
  durationMinutes: z.number().int().min(1).max(720),
  weightKg: z.number().min(20).max(500).nullable(),
  reportedCalories: z.number().min(0).max(10_000).nullable(),
  performedAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(280),
}).strict();

export type ActivityInput = z.infer<typeof activityInputSchema>;

export type CalorieSource = "estimated" | "reported" | "not_estimated";

export function activityCalories(input: ActivityInput): {
  caloriesBurned: number | null;
  calorieSource: CalorieSource;
} {
  if (input.reportedCalories !== null) {
    return {
      caloriesBurned: input.reportedCalories,
      calorieSource: "reported",
    };
  }
  if (input.weightKg === null) {
    return { caloriesBurned: null, calorieSource: "not_estimated" };
  }

  const met = MET[input.activityType][input.intensity];
  const value = (met * 3.5 * input.weightKg * input.durationMinutes) / 200;
  return {
    caloriesBurned: Math.round(value * 10) / 10,
    calorieSource: "estimated",
  };
}

export function activityTimeValid(iso: string, now = new Date()): boolean {
  const time = Date.parse(iso);
  return Number.isFinite(time) &&
    time >= Date.UTC(2020, 0, 1) &&
    time <= now.getTime() + 5 * 60_000;
}

/** Calendar day in Philippine time, independent of the web server's timezone. */
export function manilaDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
