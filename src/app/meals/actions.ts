"use server";
import { normalizeConsumedAt } from "../../lib/meal-time";

import {
  foodAnalysisSchema,
} from "../../lib/food-analysis";

import {
  createClient,
} from "../../lib/supabase/server";

export type SaveMealResult =
  | {
      ok: true;
      mealId: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "INVALID_ANALYSIS"
        | "INVALID_MEAL_TIME"
        | "SAVE_FAILED";
      message: string;
    };

export async function saveMeal(
  input: unknown,
  consumedAt?: string
): Promise<SaveMealResult> {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message:
        "You need to sign in before saving a meal.",
    };
  }

  const parsed =
    foodAnalysisSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_ANALYSIS",
      message:
        "The meal analysis is invalid.",
    };
  }

  const normalizedConsumedAt =
    normalizeConsumedAt(consumedAt);

  if (normalizedConsumedAt === null) {
    return {
      ok: false,
      code: "INVALID_MEAL_TIME",
      message:
        "Please choose a valid meal date and time that is not in the future.",
    };
  }

  const analysis = parsed.data;

  const totals =
    analysis.foods.reduce(
      (sum, food) => ({
        protein:
          sum.protein +
          food.protein,
        carbs:
          sum.carbs +
          food.carbs,
        fat:
          sum.fat +
          food.fat,
      }),
      {
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    );

  const {
    data: meal,
    error: mealError,
  } = await supabase
    .from("meals")
    .insert({
      ...(normalizedConsumedAt ? { consumed_at: normalizedConsumedAt } : {}),
      user_id: user.id,
      total_calories:
        analysis.totalCalories,
      total_protein:
        totals.protein,
      total_carbs:
        totals.carbs,
      total_fat:
        totals.fat,
      notes:
        analysis.notes,
      analysis_snapshot:
        analysis,
    })
    .select("id")
    .single();

  if (mealError || !meal) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      message:
        "We couldn't save your meal.",
    };
  }

  const items =
    analysis.foods.map(
      (food) => ({
        meal_id: meal.id,
        user_id: user.id,
        name: food.name,
        estimated_grams:
          food.estimatedGrams,
        calories:
          food.calories,
        protein:
          food.protein,
        carbs:
          food.carbs,
        fat:
          food.fat,
        confidence:
          food.confidence,
        weight_source:
          food.weightSource ??
          null,
        nutrition_source:
          food.nutritionSource ??
          null,
      })
    );

  if (items.length > 0) {
    const {
      error: itemsError,
    } = await supabase
      .from("meal_items")
      .insert(items);

    if (itemsError) {
      await supabase
        .from("meals")
        .delete()
        .eq(
          "id",
          meal.id
        )
        .eq(
          "user_id",
          user.id
        );

      return {
        ok: false,
        code: "SAVE_FAILED",
        message:
          "We couldn't save your meal.",
      };
    }
  }

  return {
    ok: true,
    mealId: meal.id,
  };
}
