import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { readAdminAccountDetail } from "@/lib/admin-account-actions";
import { accountIdPattern } from "@/lib/admin-account-policy";
import { AdminAccountControls } from "@/components/admin-account-controls";
export const dynamic = "force-dynamic";

export default async function AdminAccountPage({params}:{params:Promise<{id:string}>}) {
  const access=await getAdminAccess();
  if(!access.signedIn)redirect("/auth/login");
  if(!access.isAdmin)notFound();
  const {id}=await params;
  if(!accountIdPattern.test(id))notFound();
  const detail=await readAdminAccountDetail(id).catch(()=>null);
  if(!detail||detail.status!=="ready")return <main className="mx-auto max-w-3xl p-8"><Link href="/admin/analytics/users" className="text-emerald-700">← User Management</Link><p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4">Account details unavailable. Destructive operations remain blocked. Check admin allowlisting and server configuration.</p></main>;
  return <main className="min-h-screen bg-[#f6f9f4] px-4 py-8 text-[#153d2b]"><div className="mx-auto max-w-4xl">
    <Link href="/admin/analytics/users" className="text-sm font-semibold text-emerald-700 hover:underline">← User Management</Link>
    <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-emerald-800">Restricted / Admin Operations</p><h1 className="mt-2 text-3xl font-extrabold">Manage account</h1>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="break-all text-lg font-bold">{detail.email}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">ID: {detail.id}</p><h2 className="mt-6 text-sm font-bold">User-linked record counts</h2>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{detail.counts.map(item=><div key={item.name} className="rounded-xl bg-[#f4f8f2] p-3"><p className="text-xs capitalize text-slate-600">{item.name.replaceAll("_"," ")}</p><p className="mt-1 font-bold">{item.count===null?"Unavailable":item.count}</p></div>)}</div>
    <p className="mt-3 text-xs text-slate-600">Storage preflight: {detail.storageCount===null?"Unavailable":detail.storageCount===0?"No owned objects or referenced thumbnails detected":"Objects/referenced thumbnails detected"}. AI usage records and quotas are not reset.</p>
    </section><AdminAccountControls account={detail}/>
  </div></main>;
}
