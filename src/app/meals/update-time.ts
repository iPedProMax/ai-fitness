"use server";

import { revalidatePath } from "next/cache";

import { normalizeConsumedAt } from "@/lib/meal-time";
import { createClient } from "@/lib/supabase/server";

export type UpdateMealTimeResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export async function updateMealConsumedAt(
  mealId: string,
  consumedAt: string
): Promise<UpdateMealTimeResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "Sign in to edit your meal.",
    };
  }

  const validMealId =
    typeof mealId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      mealId
    );

  const normalized =
    typeof consumedAt === "string"
      ? normalizeConsumedAt(consumedAt)
      : null;

  if (
    !validMealId ||
    typeof normalized !== "string"
  ) {
    return {
      ok: false,
      message:
        "Please choose a valid meal date and time that is not in the future.",
    };
  }

  const { data, error } = await supabase
    .from("meals")
    .update({
      consumed_at: normalized,
    })
    .eq("id", mealId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message:
        "Could not update the eating time. Please try again.",
    };
  }

  if (!data) {
    return {
      ok: false,
      message:
        "This meal was not found or you do not have access to it.",
    };
  }

  revalidatePath("/meals");
  revalidatePath("/dashboard");

  return { ok: true };
}