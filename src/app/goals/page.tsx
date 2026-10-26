import Link from "next/link";
import { redirect } from "next/navigation";
import { FitnessGoalForm } from "@/components/fitness-goal-form";
import { WeightCheckIn, type WeightRecord } from "@/components/weight-check-in";
import { FITNESS_GOALS, type FitnessGoal } from "@/lib/fitness-goals";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GoalRow = { goal_type: FitnessGoal; calorie_target: number; protein_target: number; target_weight_kg: number | null };

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view your goals."));
  const [goalResult, weightsResult] = await Promise.all([
    supabase.from("fitness_goals").select("goal_type,calorie_target,protein_target,target_weight_kg")
      .eq("user_id", user.id).maybeSingle(),
    supabase.from("weight_entries").select("id,measured_on,weight_kg")
      .eq("user_id", user.id).order("measured_on", { ascending: false }).limit(60),
  ]);
  const goal = goalResult.data as GoalRow | null;
  const validGoal = goal && FITNESS_GOALS.includes(goal.goal_type) ? {
    goal_type: goal.goal_type,
    calorie_target: Number(goal.calorie_target),
    protein_target: Number(goal.protein_target),
    target_weight_kg: goal.target_weight_kg === null ? null : Number(goal.target_weight_kg),
  } : null;
  const weights = (weightsResult.data ?? []).map(e=>({ ...e, weight_kg: Number(e.weight_kg) })) as WeightRecord[];
  return <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
    <header className="my-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your pace, your choice</p><h1 className="mt-2 text-3xl font-extrabold">Personal Goals</h1><p className="mt-2 text-sm text-slate-600">Use our free TDEE Calculator to estimate a daily calorie target, customise your goals, and optionally track your weight. No AI credits needed.</p></header>
    {(goalResult.error || weightsResult.error) && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">Could not load {goalResult.error ? "fitness goals" : "weight entries"}. Check that the Phase 5 SQL migration has been applied.</p>}
    <div className="grid gap-6">
      {goalResult.error ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Goal settings aren't available yet.</div> : <FitnessGoalForm initialGoal={validGoal} />}
      {weightsResult.error ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Weight tracking isn't available yet.</div> : <WeightCheckIn entries={weights} />}
    </div>
  </div></main>;
}
