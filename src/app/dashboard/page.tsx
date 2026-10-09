import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-8 text-white sm:px-10 sm:py-10">
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

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"
          />
        </section>

        <section className="mt-9">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Today&apos;s overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Daily totals will appear here when dashboard
              tracking is connected to your saved meals.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Calories consumed
              </p>

              <p className="mt-4 text-3xl font-extrabold text-slate-900">
                — kcal
              </p>

              <p className="mt-3 text-xs text-slate-400">
                Daily summary coming soon
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Protein consumed
              </p>

              <p className="mt-4 text-3xl font-extrabold text-slate-900">
                — g
              </p>

              <p className="mt-3 text-xs text-slate-400">
                Nutrition tracking coming soon
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Activity
              </p>

              <p className="mt-4 text-3xl font-extrabold text-slate-900">
                —
              </p>

              <p className="mt-3 text-xs text-slate-400">
                Exercise tracking coming soon
              </p>
            </div>
          </div>
        </section>

        <section className="mt-9 grid gap-5 lg:grid-cols-2">
          <Link
            href="/"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">
              ✨
            </div>

            <h2 className="text-lg font-bold">
              AI Food Scanner
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload food photos to estimate calories,
              macronutrients, and portion sizes.
            </p>

            <p className="mt-5 text-sm font-bold text-emerald-700">
              Open scanner →
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
        </section>
      </div>
    </main>
  );
}