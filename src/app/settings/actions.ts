"use server";

import { createClient } from "@/lib/supabase/server";

export type ExerciseDisplayPreferenceResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveExerciseDisplayPreference(
  showExerciseCalories: boolean
): Promise<ExerciseDisplayPreferenceResult> {
  if (typeof showExerciseCalories !== "boolean") {
    return { ok: false, message: "Please choose a valid preference." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: "Please sign in to save your preferences." };
  }

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    show_exercise_calories: showExerciseCalories,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    return { ok: false, message: "Couldn't save your preference. Check the database migration and try again." };
  }
  return { ok: true };
}
