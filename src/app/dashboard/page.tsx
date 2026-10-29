import Link from "next/link";
import { TodayOverview } from "@/components/today-overview";
import { DashboardSpotlight } from "@/components/dashboard-spotlight";
import { HealthSnapshot } from "@/components/health-snapshot";
import { AiUsageCounter } from "@/components/ai-usage-counter";

export default function DashboardPage() {
  return (
    <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <DashboardSpotlight>
          <div className="relative z-10 max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              Welcome to your dashboard
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your health journey, all in one place.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Track meals, review nutrition estimates,
              and build consistent habits with AI Fitness.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
              >
                Scan a meal
              </Link>

              <Link
                href="/meals"
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Meal History
              </Link>
            </div>
          </div>

        </DashboardSpotlight>

        <AiUsageCounter />

        <TodayOverview />

        <HealthSnapshot />

        <section className="mt-9 grid gap-5 lg:grid-cols-3">
          <Link
            href="/"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">
              ✨
            </div>

            <h2 className="text-lg font-bold">
              Log Food
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Scan photos, describe food to AI, or enter
              your own nutrition values.
            </p>

            <p className="mt-5 text-sm font-bold text-emerald-700">
              Log a meal →
            </p>
          </Link>

          <Link
            href="/meals"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-700">
              ◷
            </div>

            <h2 className="text-lg font-bold">
              Meal History
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Revisit the meals you have saved,
              including their nutrition estimates.
            </p>

            <p className="mt-5 text-sm font-bold text-emerald-700">
              View saved meals →
            </p>
          </Link>
          <Link
            href="/activities"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">
              🏋️
            </div>
            <h2 className="text-lg font-bold">Exercise & Activities</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Log workouts for free and track estimated calories burned.
            </p>
            <p className="mt-5 text-sm font-bold text-emerald-700">Log an activity →</p>
          </Link>
        </section>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/goals" className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Set personal goals →</Link>
          <Link href="/reports" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100">View daily reports →</Link>
        </div>
      </div>
    </main>
  );
}