import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { readAdminUsers } from "@/lib/admin-users";
import { safeAdminPage } from "@/lib/admin-user-format";
import { AdminUserDirectory } from "@/components/admin-user-directory";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const access = await getAdminAccess();
  if (!access.signedIn) redirect("/auth/login?message=" + encodeURIComponent("Sign in to access Khalories."));
  if (!access.isAdmin) notFound();
  const query = await searchParams;
  const current = safeAdminPage(typeof query.page === "string" ? query.page : undefined);
  const directory = await readAdminUsers(current);
  return <main className="min-h-screen bg-[#f6f9f4] px-4 py-8 text-[#153d2b] sm:px-7">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/admin/analytics" className="text-sm font-semibold text-emerald-700 hover:underline">Back to Admin Dashboard</Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Khalories AI / Operations</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">User Management</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Private account directory. No meal histories, personal health data, passwords, or AI prompts. Account actions require extra authentication, a verified support request, and server-side safeguards.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800">Admin only / Verified controls</span>
      </div>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="admin-user-list-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="admin-user-list-heading" className="text-lg font-extrabold">Accounts</h2>
            <p className="mt-1 text-xs text-slate-500">Page {directory.page}. {directory.total === null ? "Total accounts unavailable." : `${directory.total.toLocaleString()} registered accounts.`} Dates are Philippine time.</p>
          </div>
          <span className="rounded-full bg-[#f4f8f2] px-3 py-2 text-xs font-semibold text-emerald-800">Account actions require confirmation</span>
        </div>
        {directory.status === "unavailable" ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Account directory unavailable. Check the server-only Supabase service role configuration and Auth admin API permissions.</div> : <>
          <AdminUserDirectory users={directory.users}/>
          <nav aria-label="Account pages" className="mt-6 flex items-center justify-between gap-4">
            {directory.hasPrevious ? <Link href={`/admin/analytics/users?page=${directory.page - 1}`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-slate-50">Previous page</Link> : <span className="text-sm text-slate-400">First page</span>}
            <span className="text-xs text-slate-500">Page {directory.page}</span>
            {directory.hasNext ? <Link href={`/admin/analytics/users?page=${directory.page + 1}`} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Next page</Link> : <span className="text-sm text-slate-400">Last page</span>}
          </nav>
        </>}
      </section>
      <p className="mt-5 text-xs leading-5 text-slate-600">Account roles, suspensions, and sign-in times are shown for administrative review only. Any destructive action requires strict authorization, an audit trail, and a separate confirmation on the selected account page.</p>
    </div>
  </main>;
}
