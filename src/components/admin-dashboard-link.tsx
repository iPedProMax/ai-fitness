import Link from "next/link";
import { getAdminAccess } from "@/lib/admin-access";

/** This link is an affordance only; /admin/analytics separately enforces authorization. */
export async function AdminDashboardLink() {
  const access = await getAdminAccess();
  if (!access.isAdmin) return null;
  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Administrator</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Read-only registration, food, and activity analytics.</p>
        <Link href="/admin/analytics" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Open Admin Dashboard</Link>
      </div>
    </div>
  );
}
