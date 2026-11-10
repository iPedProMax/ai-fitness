import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { readAdminSummary } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

function Stat({ title, value, note }: { title: string; value: number | null; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-3 text-3xl font-extrabold text-[#153d2b]" aria-label={`${title}: ${value === null ? "Unavailable" : value}`}>{value === null ? "Unavailable" : value.toLocaleString()}</p>
    <p className="mt-2 text-xs text-slate-500">{note}</p>
  </div>;
}

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (!access.signedIn) redirect("/auth/login?message=" + encodeURIComponent("Sign in to access Khalories."));
  if (!access.isAdmin) notFound();
  // All trusted reads happen only after the server-side role check.
  const report = await readAdminSummary();
  const maximum = Math.max(1, ...(report.daily ?? []).flatMap(row => [row.meals, row.activities]));
  return <main className="min-h-screen bg-[#f6f9f4] px-4 py-8 text-[#153d2b] sm:px-7">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">Back to Dashboard</Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Khalories AI / Operations</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Admin Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Private, read-only analytics. No user emails, prompts, medical information, or meal details are displayed.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800">Admin only / Read-only</span>
      </div>
      <div className="mt-6"><Link href="/admin/analytics/ai" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-900">AI Usage & Provider Monitoring</Link></div>
      <div className="mt-3"><Link href="/admin/analytics/users" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50">User Management</Link></div>
      {report.status === "not_configured" && <div role="alert" className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Server analytics access is not configured. Set the existing SUPABASE_SERVICE_ROLE_KEY securely on the server. Do not expose it to the browser.</div>}
      <section aria-labelledby="admin-metrics-heading" className="mt-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="admin-metrics-heading" className="text-xl font-extrabold">Platform overview</h2><p className="text-xs text-slate-500">Generated {new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat title="Registered accounts" value={report.users} note="Supabase Auth account total"/>
          <Stat title="New accounts / 7 days" value={report.recentSignups} note="Registered in the last seven Philippine days"/>
          <Stat title="Saved meals" value={report.meals} note="All recorded meals"/>
          <Stat title="Meals / 7 days" value={report.recentMeals} note="Meals eaten in the last seven Philippine days"/>
          <Stat title="Activity logs" value={report.activities} note="Total saved workouts"/>
          <Stat title="Activities / 7 days" value={report.recentActivities} note="Workouts performed in the last seven Philippine days"/>
        </div>
      </section>
      <section aria-labelledby="admin-trend-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="admin-trend-heading" className="text-lg font-extrabold">Seven-day engagement</h2><p className="mt-1 text-xs text-slate-500">Logged meals and workouts by Philippine calendar date; not unique active users.</p></div><div className="flex gap-4 text-xs font-semibold"><span className="text-emerald-800">Meals</span><span className="text-lime-700">Activities</span></div></div>
        {report.daily ? <div className="mt-7 grid grid-cols-7 gap-2 sm:gap-4">{report.daily.map(day => <div key={day.day} className="min-w-0 text-center"><div className="flex h-36 items-end justify-center gap-1 rounded-xl bg-[#f5f8f2] px-1 pb-2 sm:gap-2"><div role="img" aria-label={`${day.meals} meals on ${day.day}`} style={{height:`${Math.max(day.meals ? 5 : 2, day.meals / maximum * 115)}px`}} className="w-3 rounded-t bg-emerald-800 sm:w-5"/><div role="img" aria-label={`${day.activities} workouts on ${day.day}`} style={{height:`${Math.max(day.activities ? 5 : 2, day.activities / maximum * 115)}px`}} className="w-3 rounded-t bg-lime-500 sm:w-5"/></div><p className="mt-2 truncate text-[10px] font-semibold text-slate-600 sm:text-xs">{day.day.slice(5)}</p><p className="text-[10px] text-slate-500">{day.meals} / {day.activities}</p></div>)}</div>
          : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Trends unavailable or over the safe 500-record display limit. Aggregate counters above can still be available.</p>}
      </section>
      <section aria-label="Operational status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-extrabold">Operations & data integrity</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><p className="rounded-xl bg-[#f4f8f2] p-4 text-sm">Analytics are server-rendered and scoped to authorized administrators. No public admin JSON endpoint.</p><p className="rounded-xl bg-[#f4f8f2] p-4 text-sm">AI usage and provider accounting are available in AI Monitoring. This overview does not ping external providers.</p></div>
        {report.notes.length > 0 && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Data completeness notices</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">{report.notes.map(note => <li key={note}>{note}</li>)}</ul></div>}
      </section>
    </div>
  </main>;
}
