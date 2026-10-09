"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";

type IconName =
  | "dashboard"
  | "scanner"
  | "history"
  | "reports"
  | "activities"
  | "settings";

type NavItem = {
  label: string;
  icon: IconName;
  href?: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
  },
  {
    label: "Log Food",
    href: "/",
    icon: "scanner",
  },
  {
    label: "Meal History",
    href: "/meals",
    icon: "history",
  },
  {
    label: "Daily Reports",
    icon: "reports",
  },
  {
    label: "Activities",
    icon: "activities",
  },
  {
    label: "Settings",
    icon: "settings",
  },
];

const iconPaths: Record<IconName, string> = {
  dashboard:
    "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  scanner:
    "M4 9V5a1 1 0 0 1 1-1h4 M15 4h4a1 1 0 0 1 1 1v4 M20 15v4a1 1 0 0 1-1 1h-4 M9 20H5a1 1 0 0 1-1-1v-4 M7 12h10",
  history:
    "M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 7v5l4 2",
  reports:
    "M5 20v-7 M12 20V4 M19 20v-11",
  activities:
    "M3 9v6 M6 7v10 M18 7v10 M21 9v6 M6 12h12",
  settings:
    "M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
};

function NavIcon({ icon }: { icon: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d={iconPaths[icon]} />
    </svg>
  );
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navItems.map((item) => {
        const active =
          item.href === pathname;

        const base =
          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition";

        if (!item.href) {
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className={`${base} cursor-not-allowed text-slate-400`}
            >
              <NavIcon icon={item.icon} />

              <span className="min-w-0 flex-1">
                {item.label}
              </span>

              <span className="rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-medium text-slate-400">
                Soon
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${base} ${
              active
                ? "bg-emerald-50 font-semibold text-emerald-700"
                : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <NavIcon icon={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-extrabold text-white shadow-sm">
        AF
      </span>

      <span>
        <span className="block text-lg font-extrabold tracking-tight text-slate-900">
          AI Fitness
        </span>

        <span className="block text-xs text-slate-400">
          Your wellness workspace
        </span>
      </span>
    </Link>
  );
}

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAppRoute =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/meals";

  // Login, sign-up and authentication callbacks
  // keep their original pages without the sidebar.
  if (!isAppRoute) {
    return <>{children}</>;
  }

  const pageTitle =
    pathname === "/dashboard"
      ? "Dashboard"
      : pathname === "/meals"
        ? "Meal History"
        : "Log Food";

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>

        <div className="mt-10">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Workspace
          </p>

          <Navigation pathname={pathname} />
        </div>

        <div className="mt-auto rounded-2xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Small steps count.
          </p>

          <p className="mt-1 text-xs leading-5 text-emerald-700">
            Build consistency, one meal and activity at a time.
          </p>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-controls="mobile-app-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                className="h-5 w-5"
              >
                {mobileOpen ? (
                  <path d="M5 5l14 14M19 5 5 19" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-400">
                AI Fitness
              </p>

              <h2 className="truncate text-lg font-bold text-slate-900">
                {pageTitle}
              </h2>
            </div>

            <AccountMenu />
          </div>

          <div
            id="mobile-app-navigation"
            className={`border-t border-slate-100 bg-white p-4 lg:hidden ${
              mobileOpen ? "block" : "hidden"
            }`}
          >
            <Navigation
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </header>

        <div className="min-h-[calc(100vh-76px)]">
          {children}
        </div>
      </div>
    </div>
  );
}