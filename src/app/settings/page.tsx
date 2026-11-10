import Link from "next/link";
import "./settings-dark.css";
import { redirect } from "next/navigation";
import { ReplayTourButton } from "@/components/replay-tour-button";
import { ExerciseDisplaySettings } from "@/components/exercise-display-settings";
import { ProfilePersonalization } from "@/components/profile-personalization";
import { createClient } from "@/lib/supabase/server";
import { normalizeFocus, safeAvatarPath } from "@/lib/profile-appearance";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to view your settings."));

  const { data, error } = await supabase.from("user_preferences")
    .select("show_exercise_calories")
    .eq("user_id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};
  const initialName = typeof metadata.full_name === "string" ? metadata.full_name
    : typeof metadata.name === "string" ? metadata.name : (user.email?.split("@")[0] ?? "Member");
  const bio = typeof metadata.khalories_bio === "string" ? metadata.khalories_bio : "";

  return (
    <main className="khalories-settings-root min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">← Back to dashboard</Link>
        <header className="khalories-settings-hero relative mt-6 overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-[#edf9e8] via-[#f8fbf3] to-[#fff6e9] px-6 py-8 sm:px-9 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-[#d7efc5]/55" />
          <div className="relative max-w-xl">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">Your space, your rules</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Make Khalories yours.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">Your profile, your vibe, your wellness journey. A little more you, with the same easy tracking.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-emerald-800">
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm">✦ Personal profile</span>
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm">◐ Appearance</span>
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm">♡ Daily preferences</span>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.85fr)] lg:items-start">
          <ProfilePersonalization
            userId={user.id}
            email={user.email ?? ""}
            initialName={initialName}
            initialBio={bio}
            initialFocus={normalizeFocus(metadata.khalories_focus)}
            initialAvatarPath={safeAvatarPath(user.id, metadata.khalories_avatar_path)}
          />
          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your goals</p>
              <h2 className="mt-2 text-xl font-extrabold">Keep your eyes on the prize.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Fine-tune your daily nutrition goals whenever life changes. Small steps still count.</p>
              <Link href="/goals" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white transition hover:bg-emerald-800">Manage nutrition goals →</Link>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your account</p>
              <h2 className="mt-2 text-lg font-extrabold">Private by design</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Profile photos are stored privately. Your original full-resolution photo never gets uploaded: Khalories sends only the compressed version.</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">Changing your name or profile photo doesn't affect your login, nutrition history, or AI credits.</p>
            </section>
          </aside>
        </div>

        {error ? (
          <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700">Could not load your preferences. Run the user preferences SQL migration and reload this page.</div>
        ) : (
          <ExerciseDisplaySettings initialShowExerciseCalories={data?.show_exercise_calories === true} />
        )}
        <div className="mt-6"><ReplayTourButton /></div>
      </div>
    </main>
  );
}
