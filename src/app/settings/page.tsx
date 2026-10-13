import Link from "next/link";
import { redirect } from "next/navigation";
import { ExerciseDisplaySettings } from "@/components/exercise-display-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view your settings."));

  const { data, error } = await supabase.from("user_preferences")
    .select("show_exercise_calories")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Make AI Fitness yours</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Choose what you want to focus on. These settings are saved to your account.</p>

        {error ? (
          <div role="alert" className="mt-7 rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700">
            Could not load your preferences. Run the user preferences SQL migration and reload this page.
          </div>
        ) : (
          <ExerciseDisplaySettings initialShowExerciseCalories={data?.show_exercise_calories === true} />
        )}

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <h2 className="font-bold text-slate-900">Personal nutrition goals</h2>
          <p className="mt-2 leading-6">Set your own daily calorie and protein goals. Exercise won't automatically increase your food budget.</p>
          <Link href="/goals" className="mt-3 inline-block font-semibold text-emerald-700 hover:underline">Manage my goals →</Link>
        </section>
      </div>
    </main>
  );
}
