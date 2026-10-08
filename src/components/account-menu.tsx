"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

type AccountInfo = {
  name: string;
  email: string;
  initial: string;
};

export function AccountMenu() {
  const [account, setAccount] =
    useState<AccountInfo | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setAccount(null);
        setLoading(false);
        return;
      }

      const name =
        user.user_metadata
          ?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "Account";

      setAccount({
        name,
        email: user.email ?? "",
        initial:
          name.charAt(0).toUpperCase() ||
          "P",
      });

      setLoading(false);
    }

    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="h-10 w-10 rounded-full bg-slate-100" />
    );
  }

  if (!account) {
    return (
      <Link
        href="/auth/login"
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Sign in
      </Link>
    );
  }

  return (
    <details className="relative">
      <summary
        aria-label="Open account menu"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 transition hover:bg-emerald-200 [&::-webkit-details-marker]:hidden"
      >
        {account.initial}
      </summary>

      <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="border-b border-slate-100 px-2 pb-3">
          <p className="truncate text-sm font-semibold text-slate-900">
            {account.name}
          </p>

          {account.email && (
            <p className="mt-1 truncate text-xs text-slate-500">
              {account.email}
            </p>
          )}
        </div>

        <Link
          href="/meals"
          className="mt-2 block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Meal History
        </Link>
        <form
          action={signOut}
          className="pt-2"
        >
          <button
            type="submit"
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
