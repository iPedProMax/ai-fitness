"use client";

import { BEGINNER_TOUR_EVENT } from "@/lib/beginner-tour";

/** The tour is mounted in AppShell and listens for this same-tab event. */
export function ReplayTourButton() {
  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">New to Khalories AI?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Explore the app with a short, interactive spotlight walkthrough. You can skip anytime.
      </p>
      <button
        type="button"
        data-khalories-tour="replay"
        onClick={() => window.dispatchEvent(new Event(BEGINNER_TOUR_EVENT))}
        className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        Replay Beginner Tutorial
      </button>
    </section>
  );
}