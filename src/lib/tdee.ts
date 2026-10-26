import type { FitnessGoal } from "@/lib/fitness-goals";

export const TDEE_ACTIVITY_LEVELS = {
  sedentary: { label: "Mostly sitting (little exercise)", multiplier: 1.2 },
  light: { label: "Lightly active (1–3 workout days/week)", multiplier: 1.375 },
  moderate: { label: "Moderately active (3–5 workout days/week)", multiplier: 1.55 },
  very: { label: "Very active (6–7 workout days/week)", multiplier: 1.725 },
  extra: { label: "Very physical work plus regular training", multiplier: 1.9 },
} as const;

export type TdeeActivityLevel = keyof typeof TDEE_ACTIVITY_LEVELS;
export type TdeeSex = "male" | "female";

export type TdeeInput = {
  ageYears: number;
  heightCm: number;
  weightKg: number;
  sex: TdeeSex;
  activityLevel: TdeeActivityLevel;
  goalType: FitnessGoal;
};

export type TdeeEstimate = {
  bmrCalories: number;
  maintenanceCalories: number;
  suggestedCalories: number | null;
  suggestedProteinGrams: number;
  bmi: number;
  explanation: string;
  caution: string | null;
};

/**
 * Adult-only Mifflin–St Jeor BMR, then TDEE = BMR × estimated activity factor.
 * The sex-specific constants are limitations of this equation, not gender identity labels.
 * All estimates are approximate, not medical prescriptions or measured energy expenditure.
 */
export function calculateTdee(input: TdeeInput): TdeeEstimate {
  const { ageYears, heightCm, weightKg, sex, activityLevel, goalType } = input;
  if (
    !Number.isInteger(ageYears) || ageYears < 18 || ageYears > 100 ||
    !Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230 ||
    !Number.isFinite(weightKg) || weightKg < 30 || weightKg > 250 ||
    (sex !== "male" && sex !== "female") ||
    !Object.prototype.hasOwnProperty.call(TDEE_ACTIVITY_LEVELS, activityLevel) ||
    !["lose", "maintain", "gain"].includes(goalType)
  ) {
    throw new Error("Enter an age of 18–100, height of 120–230 cm, weight of 30–250 kg, and your activity level and formula option.");
  }

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161);
  const maintenance = Math.round(bmr * TDEE_ACTIVITY_LEVELS[activityLevel].multiplier);
  const adjustment = goalType === "lose" ? -250 : goalType === "gain" ? 200 : 0;
  const candidate = Math.round((maintenance + adjustment) / 10) * 10;
  const bmi = Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
  let caution: string | null = null;
  let suggestedCalories: number | null = candidate;
  if (goalType === "lose" && bmi < 18.5) {
    suggestedCalories = null;
    caution = "Your BMI is below the typical adult reference range. We won't automatically recommend losing weight; please seek qualified, individual guidance.";
  } else if (goalType === "lose" && candidate < 1500) {
    suggestedCalories = null;
    caution = "Your estimated maintenance needs are relatively low. We won't automatically suggest a lower calorie target; consider individual advice from a qualified professional.";
  } else if (candidate < 800 || candidate > 6000) {
    suggestedCalories = null;
    caution = "This estimate is outside the supported target range. Please seek individual guidance before setting a calorie target.";
  }

  const goalExplanation = goalType === "lose"
    ? "A modest starting deficit of about 250 kcal/day."
    : goalType === "gain"
      ? "A modest starting surplus of about 200 kcal/day."
      : "Maintenance aims to match your estimated daily energy use.";

  return {
    bmrCalories: Math.round(bmr),
    maintenanceCalories: maintenance,
    suggestedCalories,
    suggestedProteinGrams: Math.round(weightKg * (goalType === "maintain" ? 1.2 : 1.4)),
    bmi,
    explanation: goalExplanation,
    caution,
  };
}
