import "server-only";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAiModelStatuses } from "@/lib/ai/model-status";

export const dynamic = "force-dynamic";
const countLabel = (value: number | null): string => value === null ? "Not configured" : value.toLocaleString("en-PH");

/** No access without an explicit server-side admin UID allowlist. Never trust a client-provided role. */
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: {user}, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to Khalories AI."));
  const allowed = (process.env.KHALORIES_ADMIN_USER_IDS || "").split(",").map(id => id.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(user.id.toLowerCase())) notFound();

  let userCount: number | null = null;
  let mealsCount: number | null = null;
  let activityCount: number | null = null;
  let analysesWeek: number | null = null;
  let storageCount: number | null = null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    // This server-only key never reaches a client component or response.
    const admin = createAdminClient(getSupabaseConfig().url, serviceRoleKey, {auth:{persistSession:false, autoRefreshToken:false}});
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, meals, activities, requests, thumbnails] = await Promise.all([
      admin.auth.admin.listUsers({page:1,perPage:1}),
      admin.from("meals").select("id",{head:true,count:"exact"}),
      admin.from("activities").select("id",{head:true,count:"exact"}),
      admin.from("ai_requests").select("request_key",{head:true,count:"exact"}).gte("created_at", week),
      admin.storage.from("meal-thumbnails").list("", {limit:1}),
    ]);
    userCount = users.error ? null : typeof users.data?.total === "number" ? users.data.total : null;
    mealsCount = meals.error ? null : meals.count;
    activityCount = activities.error ? null : activities.count;
    analysesWeek = requests.error ? null : requests.count;
    // Bucket list is only a connectivity check; NOT a count of all stored files.
    storageCount = thumbnails.error ? null : 1;
  }
  const statuses = await getAiModelStatuses().catch(() => []);
  const displayed = statuses.filter(entry => ["gemini", "groq", "cloudflare", "openrouter"].includes(entry.id));
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-5xl space-y-6">
    <header><Link href="/dashboard" className="text-sm font-semibold text-emerald-700">← Back to Khalories</Link><p className="mt-5 text-xs font-bold uppercase tracking-wider text-emerald-700">Restricted · owner access</p><h1 className="mt-2 text-3xl font-bold">Khalories AI — Admin</h1><p className="mt-2 text-sm text-slate-600">Aggregate operational statistics only. No private meal images, meal history, or user health profiles are shown.</p></header>
    {!serviceRoleKey&&<p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Owner authorization works, but aggregate platform metrics are disabled. To enable them, configure SUPABASE_SERVICE_ROLE_KEY on the server only, after reviewing its security implications.</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Aggregate platform metrics">
      {[{label:"Registered users",value:userCount},{label:"Saved meals",value:mealsCount},{label:"Activity logs",value:activityCount},{label:"AI requests · 7 days",value:analysesWeek}].map(item=><div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{countLabel(item.value)}</p></div>)}
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-900">Provider configuration</h2><p className="mt-1 text-xs text-slate-500">Server-side configuration and admission policy, not guaranteed live upstream availability.</p>
      <div className="mt-4 divide-y divide-slate-100">{displayed.length===0?<p className="text-sm text-slate-600">Could not load provider configuration.</p>:displayed.map(item=><div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><span className="font-semibold text-slate-900">{item.name}</span><span className={item.enabled?"font-semibold text-emerald-700":"text-slate-500"}>{item.enabled?"Enabled":"Unavailable"}</span></div>)}</div>
    </section>
    <p className="text-xs text-slate-500">There is no admin user-search, deletion, arbitrary SQL, quota modification, or private-photo inspection in this initial read-only dashboard. {storageCount!==null?"Private storage bucket connectivity checked.":"Storage bucket totals are not shown without a verified aggregate count."}</p>
  </div></main>;
}
