"use server";

import { revalidatePath } from "next/cache";
import { fitnessGoalInputSchema, weightDateValid, weightEntryInputSchema } from "@/lib/fitness-goals";
import { createClient } from "@/lib/supabase/server";

export type GoalActionResult = { ok: true } | { ok: false; message: string };

export async function saveFitnessGoal(input: unknown): Promise<GoalActionResult> {
  const parsed = fitnessGoalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the goal and target values." };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, message: "Sign in to save your goals." };
  const { goalType, calorieTarget, proteinTarget, targetWeightKg } = parsed.data;
  const { error } = await supabase.from("fitness_goals").upsert({
    user_id: user.id,
    goal_type: goalType,
    calorie_target: calorieTarget,
    protein_target: proteinTarget,
    target_weight_kg: targetWeightKg,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Could not save goals. Check the Phase 5 database migration." };
  revalidatePath("/goals"); revalidatePath("/reports"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveWeightEntry(input: unknown): Promise<GoalActionResult> {
  const parsed = weightEntryInputSchema.safeParse(input);
  if (!parsed.success || !weightDateValid(parsed.data.measuredOn)) {
    return { ok: false, message: "Enter a valid weight and a date that is not in the future." };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, message: "Sign in to save your weight." };
  const { error } = await supabase.from("weight_entries").upsert({
    user_id: user.id,
    measured_on: parsed.data.measuredOn,
    weight_kg: parsed.data.weightKg,
  }, { onConflict: "user_id,measured_on" });
  if (error) return { ok: false, message: "Could not save weight. Check the Phase 5 database migration." };
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteWeightEntry(id: string): Promise<GoalActionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Invalid weight entry." };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, message: "Sign in to delete your weight entry." };
  const { error } = await supabase.from("weight_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Could not delete that weight entry." };
  revalidatePath("/goals");
  return { ok: true };
}
