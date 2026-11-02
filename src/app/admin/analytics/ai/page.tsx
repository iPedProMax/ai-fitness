import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { readAdminAiSummary } from "@/lib/admin-ai-metrics";

export const dynamic = "force-dynamic";

function Stat({ title, value, note }: { title: string; value: number | null; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-3 text-3xl font-extrabold text-[#153d2b]">{value === null ? "Unavailable" : value.toLocaleString()}</p>
    <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
  </div>;
}

export default async function AdminAiPage() {
  const access = await getAdminAccess();
  if (!access.signedIn) redirect("/auth/login?message=" + encodeURIComponent("Sign in to access Khalories."));
  if (!access.isAdmin) notFound();
  const report = await readAdminAiSummary();
  const credits = report.days ? {
    analyses: report.days.reduce((s,d) => s+d.analyses,0),
    refinements: report.days.reduce((s,d) => s+d.refinements,0),
  } : null;
  const max = Math.max(1,...(report.days ?? []).flatMap(d => [d.analyses,d.refinements]));
  const now = new Date(report.generatedAt).getTime();
  return <main className="min-h-screen bg-[#f6f9f4] px-4 py-8 text-[#153d2b] sm:px-7">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/admin/analytics" className="text-sm font-semibold text-emerald-700 hover:underline">Back to Admin Dashboard</Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Khalories AI / Operations</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">AI Usage & Provider Monitoring</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Read-only accounting records; no prompts, individual accounts, or meal content. These are not live provider health checks.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800">Admin only / Read-only</span>
      </div>
      {report.status === "not_configured" && <p role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">Server-side accounting is not configured.</p>}
      <section aria-label="AI credit overview" className="mt-8">
        <div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="text-xl font-extrabold">Last seven Philippine days</h2><p className="text-xs text-slate-500">Generated {new Date(report.generatedAt).toLocaleString("en-PH", {timeZone:"Asia/Manila"})}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat title="Analysis credits used" value={credits?.analyses ?? null} note="Sum of stored daily account counters; includes failed attempts when charged." />
          <Stat title="Refinement credits used" value={credits?.refinements ?? null} note="Saved refinement usage, not provider request totals." />
          <Stat title="Completed AI requests" value={report.outcomes?.completed ?? null} note="Recorded completed request rows; distinct from consumed credits." />
          <Stat title="Error responses" value={report.outcomes?.errors ?? null} note="HTTP 4xx/5xx statuses on completed requests; not necessarily provider failures." />
          <Stat title="Timeout responses" value={report.outcomes?.timeouts ?? null} note="Recorded HTTP 504 responses; other timeouts may not be identifiable." />
          <Stat title="Still running" value={report.outcomes?.running ?? null} note="Rows marked running; may include stale or interrupted requests." />
        </div>
      </section>
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="y2-credits-heading">
        <div><h2 id="y2-credits-heading" className="text-lg font-extrabold">AI credits by day</h2><p className="mt-1 text-xs text-slate-500">Used analyses and refinements. Dates follow Philippine time; values come from aggregate daily counters.</p></div>
        {report.days ? <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4">{report.days.map(day => <div key={day.day} className="min-w-0 text-center">
          <div className="flex h-36 items-end justify-center gap-1 rounded-xl bg-[#f5f8f2] px-1 pb-2 sm:gap-2">
            <div role="img" aria-label={`${day.analyses} analysis credits on ${day.day}`} style={{height:`${Math.max(day.analyses ? 5 : 2, day.analyses / max * 115)}px`}} className="w-3 rounded-t bg-emerald-800 sm:w-5"/>
            <div role="img" aria-label={`${day.refinements} refinement credits on ${day.day}`} style={{height:`${Math.max(day.refinements ? 5 : 2, day.refinements / max * 115)}px`}} className="w-3 rounded-t bg-lime-500 sm:w-5"/>
          </div><p className="mt-2 text-xs font-semibold">{day.day.slice(5)}</p><p className="text-[10px] text-slate-500">{day.analyses} / {day.refinements}</p>
        </div>)}</div> : <p className="mt-4 text-sm text-slate-600">Daily usage history is unavailable or incomplete.</p>}
        <p className="mt-4 text-xs text-slate-500">Dark green: analyses. Lime: refinements. A saved zero means none recorded; unavailable data is never treated as zero.</p>
      </section>
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="y2-providers-heading">
        <h2 id="y2-providers-heading" className="text-lg font-extrabold">Provider accounting & policy</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Recorded attempts and token accounting from the last seven UTC provider-day windows. Attempts are not unique meals or necessarily successful calls. Policy settings are not live uptime measurements.</p>
        {report.providers ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Provider</th><th className="p-3">Policy</th><th className="p-3 text-right">Attempts</th><th className="p-3 text-right">Tokens accounted</th><th className="p-3">Capacity</th></tr></thead><tbody>
          {report.providers.map(provider => <tr key={provider.provider} className="border-b last:border-b-0"><td className="p-3 font-semibold">{provider.provider}</td><td className="p-3 text-xs">{provider.enabled ? provider.freeVerified ? "Enabled / free verified" : "Enabled / verification pending" : "Disabled"}</td><td className="p-3 text-right tabular-nums">{provider.requests.toLocaleString()}</td><td className="p-3 text-right tabular-nums">{provider.tokens.toLocaleString()}</td><td className="p-3 text-xs">{provider.cooldownUntil && Date.parse(provider.cooldownUntil) > now ? "Cooldown recorded" : provider.dailyRequestLimit ? `Policy: ${provider.dailyRequestLimit}/day` : "No daily limit recorded"}</td></tr>)}
        </tbody></table></div> : <p className="mt-4 text-sm text-slate-600">Provider records are unavailable or incomplete.</p>}
      </section>
      <section aria-label="AI analytics limitations" className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-extrabold">Data integrity & limitations</h2>
        <p className="mt-2 text-sm text-slate-600">No live provider pings, billing verification, measured latency, per-user analytics, automatic retries, or provider configuration writes. Counts describe stored records only.</p>
        {report.notices.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status"><p className="font-semibold text-amber-900">Incomplete data</p><ul className="mt-2 list-disc pl-5 text-sm text-amber-900">{report.notices.map(msg => <li key={msg}>{msg}</li>)}</ul></div>}
      </section>
    </div>
  </main>;
}
