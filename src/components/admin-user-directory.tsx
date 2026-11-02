"use client";
import { useMemo, useState } from "react";
import type { AdminDirectoryUser } from "@/lib/admin-user-format";

/** Search is explicitly restricted to this page's 20 accounts. No network calls. */
export function AdminUserDirectory({ users }: { users: AdminDirectoryUser[] }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-US");
    return query ? users.filter(user =>
      user.email.toLocaleLowerCase("en-US").includes(query) || user.id.toLocaleLowerCase("en-US").includes(query)) : users;
  }, [search, users]);
  return <div>
    <label htmlFor="admin-user-filter" className="block text-sm font-bold text-[#153d2b]">Filter these 20 accounts</label>
    <input id="admin-user-filter" type="search" autoComplete="off" value={search}
      onChange={event => setSearch(event.target.value)}
      placeholder="Email or account ID (current page)"
      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
    <p aria-live="polite" className="mt-2 text-xs text-slate-500">Showing {shown.length} of {users.length} account{users.length === 1 ? "" : "s"} on this page. Filters do not search other pages.</p>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-[#f4f8f2] text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>
          <th scope="col" className="px-4 py-4">Account</th><th scope="col" className="px-4 py-4">Joined (PH)</th>
          <th scope="col" className="px-4 py-4">Last sign-in</th><th scope="col" className="px-4 py-4">Role</th>
          <th scope="col" className="px-4 py-4">Status</th>
        </tr></thead>
        <tbody>{shown.map(user => <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
          <td className="px-4 py-4"><p className="break-all font-semibold text-[#153d2b]">{user.email}</p><p className="mt-1 font-mono text-[11px] text-slate-500" title={user.id}>ID: {user.id.slice(0,8)}…</p></td>
          <td className="whitespace-nowrap px-4 py-4 text-slate-600">{user.joined}</td>
          <td className="whitespace-nowrap px-4 py-4 text-slate-600">{user.lastSignIn}</td>
          <td className="px-4 py-4 font-semibold text-slate-700">{user.role}</td>
          <td className="px-4 py-4"><span className="rounded-full border border-slate-200 bg-[#f4f8f2] px-3 py-1.5 text-xs font-semibold text-emerald-900">{user.status}</span></td>
        </tr>)}</tbody>
      </table>
      {shown.length === 0 && <p className="p-5 text-sm text-slate-500">No accounts match this page filter.</p>}
    </div>
  </div>;
}
