/** Minimal, nonclinical summary for AURA and the dashboard. No raw user history. */
export type CoachUserSummary = {
  asOfDay: string;
  today: {
    mealCount: number;
    calories: number;
    proteinGrams: number;
    proteinIncomplete: boolean;
  };
  past7Days: {
    daysWithMeals: number;
    mealCount: number;
    activitySessions: number;
    activityMinutes: number;
    averageCaloriesOnLoggedDays?: number | null;
    averageProteinOnLoggedDays?: number | null;
  };
  waterTodayMl?: number;
  goal: {
    type: "lose" | "maintain" | "gain";
    calories: number;
    proteinGrams: number;
    targetWeightKg: number | null;
  } | null;
  latestWeight: { kg: number; date: string } | null;
  recentFoodNames: string[];
  limitedHistory: boolean;
};

/** A rule-based tip is available even if the AI provider is offline. */
export function coachDailyNudge(summary: CoachUserSummary): string {
  if (summary.limitedHistory) {
    return "Some older entries are not included in this snapshot. Open Reports for more detail.";
  }
  if (summary.today.mealCount === 0) {
    return "No meals saved today yet. Log a meal whenever you're ready to make your nutrition summary more useful.";
  }
  if (!summary.goal) {
    return "You've started logging food. Set a personal goal to see how your saved meals compare with your target.";
  }
  if (summary.today.proteinIncomplete) {
    return "Some protein amounts are missing from today's meals. Filling them in will make your protein progress more reliable.";
  }
  if (summary.today.proteinGrams < summary.goal.proteinGrams) {
    return `You've logged ${Math.round(summary.today.proteinGrams)} g of protein toward your ${summary.goal.proteinGrams} g target so far. A protein source in your next meal could help.`;
  }
  return "Your logged protein has reached your target today. Keep eating a balanced variety of foods and logging what you eat.";
}
