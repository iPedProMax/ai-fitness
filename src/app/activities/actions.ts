"use server";

import { activityCalories, activityInputSchema, activityTimeValid } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

export type ActivityActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveActivity(input: unknown): Promise<ActivityActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: "Sign in to save an activity." };
  }

  const parsed = activityInputSchema.safeParse(input);
  if (!parsed.success || !activityTimeValid(parsed.data.performedAt)) {
    return { ok: false, message: "Check your activity details and date." };
  }

  const activity = parsed.data;
  const calorieEstimate = activityCalories(activity);
  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    activity_type: activity.activityType,
    intensity: activity.intensity,
    duration_minutes: activity.durationMinutes,
    weight_kg: activity.weightKg,
    calories_burned: calorieEstimate.caloriesBurned,
    calorie_source: calorieEstimate.calorieSource,
    performed_at: activity.performedAt,
    notes: activity.notes,
  });

  if (error) {
    return { ok: false, message: "Could not save your activity. Check that the activities database migration is installed." };
  }
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<ActivityActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: "Sign in to delete an activity." };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Invalid activity ID." };
  }
  const { error } = await supabase.from("activities")
    .delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Could not delete the activity." };
  return { ok: true };
}
