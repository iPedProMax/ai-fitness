import Link from "next/link";
import { coachDailyNudge } from "@/lib/coach-insights";
import { readCoachUserSummary } from "@/lib/coach-user-context";

/** Calm, lightweight dashboard cards. Never manufacture medical or biometric data. */
export async function HealthSnapshot() {
  const summary = await readCoachUserSummary();
  if (!summary) {
    return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600" aria-label="Health snapshot">
      Your additional health snapshot is temporarily unavailable. Your existing nutrition cards are unaffected.
    </section>;
  }

  const cards = [
    {
      label: "Latest logged weight",
      value: summary.latestWeight ? `${summary.latestWeight.kg.toLocaleString()} kg` : "Not logged",
      note: summary.latestWeight ? `Checked on ${summary.latestWeight.date}` : "Optional — track at your own pace",
      href: "/goals", action: "Weight entries",
    },
    {
      label: "Movement logged · 7 days",
      value: `${summary.past7Days.activityMinutes.toLocaleString()} min`,
      note: `${summary.past7Days.activitySessions} saved activity ${summary.past7Days.activitySessions === 1 ? "session" : "sessions"}; not a fitness score`,
      href: "/activities", action: "Activities",
    },
    {
      label: "Days with meal logs · 7 days",
      value: `${summary.past7Days.daysWithMeals} of 7`,
      note: "Only saved records count; missing days may simply be unlogged",
      href: "/reports", action: "Daily reports",
    },
  ];
  return <section className="mt-7" aria-labelledby="health-snapshot-heading">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="health-snapshot-heading" className="text-xl font-bold">Your health snapshot</h2>
        <p className="mt-1 text-sm text-slate-500">Simple facts from your own logs. No health score or diagnosis.</p>
      </div>
      <Link href="/coach" className="text-sm font-bold text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">Ask AURA</Link>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(card => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-600">{card.label}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{card.note}</p>
        <Link href={card.href} className="mt-3 inline-block text-xs font-bold text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">{card.action} →</Link>
      </div>)}
    </div>
    {summary.past7Days.averageCaloriesOnLoggedDays != null &&
      <p className="mt-3 text-xs text-slate-600">Average on days with saved meals (past 7 days): <strong>{summary.past7Days.averageCaloriesOnLoggedDays.toLocaleString()} kcal</strong>. Unlogged days are excluded. This is not your estimated total daily expenditure.</p>}
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="font-semibold text-slate-900">A small tip for today</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{coachDailyNudge(summary)}</p>
      <p className="mt-2 text-xs text-slate-500">Based on saved records, not a medical recommendation. Personalized AI replies are optional inside AURA.</p>
    </div>
  </section>;
}
