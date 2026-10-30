import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FITNESS_GOALS, type FitnessGoal } from "@/lib/fitness-goals";
import { createWeeklyReport, recentManilaDays, type DatedMeal } from "@/lib/weekly-report";
import type { CoachUserSummary } from "@/lib/coach-insights";

function positive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Uses ONLY the authenticated user's RLS-scoped rows and returns a short snapshot.
 * Never use the service-role client here. Fail closed on missing auth or query errors.
 * The day boundary is explicitly Asia/Manila, consistent with the weekly report.
 */
export async function readCoachUserSummary(): Promise<CoachUserSummary | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const days = recentManilaDays();
    const start = `${days[0]}T00:00:00+08:00`;
    const [mealsResult, goalsResult, weightsResult, activitiesResult] = await Promise.all([
      supabase.from("meals")
        .select("id,consumed_at,total_calories,total_protein,total_carbs,total_fat,analysis_snapshot")
        .eq("user_id", user.id).gte("consumed_at", start)
        .order("consumed_at", { ascending: false }).limit(400),
      supabase.from("fitness_goals")
        .select("goal_type,calorie_target,protein_target,target_weight_kg")
        .eq("user_id", user.id).maybeSingle(),
      supabase.from("weight_entries")
        .select("weight_kg,measured_on")
        .eq("user_id", user.id).order("measured_on", { ascending: false }).limit(1),
      supabase.from("activities")
        .select("duration_minutes,performed_at")
        .eq("user_id", user.id).gte("performed_at", start)
        .order("performed_at", { ascending: false }).limit(400),
    ]);
    if (mealsResult.error || goalsResult.error || weightsResult.error || activitiesResult.error) return null;

    const meals = (mealsResult.data ?? []) as DatedMeal[];
    const report = createWeeklyReport(meals, days);
    const today = report[report.length - 1];
    const rawGoal = goalsResult.data;
    const goalType = rawGoal?.goal_type as FitnessGoal | undefined;
    const goal = goalType && FITNESS_GOALS.includes(goalType) &&
      positive(rawGoal?.calorie_target) > 0 && positive(rawGoal?.protein_target) > 0
      ? {
          type: goalType,
          calories: positive(rawGoal?.calorie_target),
          proteinGrams: positive(rawGoal?.protein_target),
          targetWeightKg: rawGoal?.target_weight_kg == null ? null : positive(rawGoal.target_weight_kg),
        }
      : null;
    const weightRow = weightsResult.data?.[0];
    const latestWeight = weightRow && positive(weightRow.weight_kg) > 0
      ? { kg: positive(weightRow.weight_kg), date: String(weightRow.measured_on) }
      : null;
    // Water table is optional. Missing migrations must not break AURA or the dashboard.
    const waterResult = await supabase.from("water_entries")
      .select("amount_ml").eq("user_id", user.id).eq("logged_on", days[days.length - 1]).limit(50);
    const waterTodayMl = !waterResult.error
      ? (waterResult.data ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount_ml) || 0), 0)
      : undefined;
    const loggedDays = report.filter(day => day.mealCount > 0);
    const averageCaloriesOnLoggedDays = loggedDays.length
      ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length)
      : null;
    const averageProteinOnLoggedDays = loggedDays.length && !loggedDays.some(day => day.protein.incomplete)
      ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein.grams, 0) / loggedDays.length * 10) / 10
      : null;
    const activities = activitiesResult.data ?? [];
    const recentFoodNames = meals.slice(0, 5).flatMap(meal => {
      const foods = (meal.analysis_snapshot as { foods?: Array<{ name?: unknown }> } | null)?.foods;
      if (!Array.isArray(foods)) return [];
      return foods.slice(0, 4).flatMap(food => {
        const name = typeof food.name === "string"
          ? food.name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60)
          : "";
        return name ? [name] : [];
      });
    }).slice(0, 8);

    return {
      asOfDay: days[days.length - 1],
      today: {
        mealCount: today.mealCount,
        calories: Math.round(today.calories),
        proteinGrams: Math.round(today.protein.grams * 10) / 10,
        proteinIncomplete: today.protein.incomplete,
      },
      past7Days: {
        daysWithMeals: report.filter(day => day.mealCount > 0).length,
        mealCount: report.reduce((sum, day) => sum + day.mealCount, 0),
        activitySessions: activities.length,
        activityMinutes: Math.round(activities.reduce((sum, item) => sum + Math.min(720, positive(item.duration_minutes)), 0)),
        averageCaloriesOnLoggedDays,
        averageProteinOnLoggedDays,
      },
      ...(waterTodayMl === undefined ? {} : { waterTodayMl }),
      goal,
      latestWeight,
      recentFoodNames,
      limitedHistory: meals.length >= 400 || activities.length >= 400,
    };
  } catch {
    return null;
  }
}
