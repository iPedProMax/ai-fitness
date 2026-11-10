"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET, PROFILE_UPDATED_EVENT, safeAvatarPath } from "@/lib/profile-appearance";

type AccountInfo = { name: string; email: string; initial: string };

export function AccountMenu() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    let requestId = 0;
    const supabase = createClient();
    async function loadUser() {
      const id = ++requestId;
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || id !== requestId) return;
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      setAvatarUrl(null);
      if (!user) { setAccount(null); setLoading(false); return; }
      const rawName = user.user_metadata?.full_name ?? user.user_metadata?.name;
      const name = typeof rawName === "string" && rawName.trim()
        ? rawName.trim() : (user.email?.split("@")[0] ?? "Account");
      setAccount({ name, email: user.email ?? "", initial: name.charAt(0).toUpperCase() || "K" });
      setLoading(false);
      const path = safeAvatarPath(user.id, user.user_metadata?.khalories_avatar_path);
      if (!path) return;
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(path);
      if (!alive || id !== requestId || error || !data) return;
      objectUrl = URL.createObjectURL(data);
      setAvatarUrl(objectUrl);
    }
    void loadUser();
    const onProfileChanged = () => { void loadUser(); };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileChanged);
    return () => {
      alive = false;
      requestId += 1;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileChanged);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (loading) return <div className="h-10 w-10 rounded-full bg-slate-100" />;
  if (!account) return <Link href="/auth/login" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Sign in</Link>;
  return (
    <details className="relative">
      <summary aria-label="Open account menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-100 font-bold text-emerald-700 shadow-sm transition hover:ring-2 hover:ring-emerald-200 [&::-webkit-details-marker]:hidden">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : account.initial}
      </summary>
      <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="border-b border-slate-100 px-2 pb-3">
          <p className="truncate text-sm font-semibold text-slate-900">{account.name}</p>
          {account.email && <p className="mt-1 truncate text-xs text-slate-500">{account.email}</p>}
        </div>
        <Link href="/settings" className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">✦ Customize profile</Link>
        <form action={signOut} className="border-t border-slate-100 pt-2">
          <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">Sign out</button>
        </form>
      </div>
    </details>
  );
}
