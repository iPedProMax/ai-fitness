"use client";

import { BeginnerTour } from "@/components/beginner-tour";
import { clearAuraConversation } from "@/lib/aura-conversation";
import { useEffect } from "react";


import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuraFloatingCoach } from "@/components/aura-floating-coach";

type IconName = "dashboard" | "scanner" | "history" | "reports" | "activities" | "settings" | "goals";
type NavItem = { label: string; icon: IconName; href: string };

// Keep the primary navigation short. Recipes live under Meal History;
// barcode, photos, and manual logging all live in Log Food.
const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "Log Food", href: "/", icon: "scanner" },
  { label: "Meal History", href: "/meals", icon: "history" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Activities", href: "/activities", icon: "activities" },
  { label: "Goals", href: "/goals", icon: "goals" },
  { label: "AI Coach", href: "/coach", icon: "reports" },
  { label: "Settings", href: "/settings", icon: "settings" },
];
const bottomItems = navItems.filter(item => ["/dashboard", "/", "/meals", "/activities"].includes(item.href));
const iconPaths: Record<IconName, string> = {
  dashboard: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  scanner: "M12 5v14 M5 12h14",
  history: "M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5",
  reports: "M5 20v-7 M12 20V4 M19 20v-11",
  activities: "M3 9v6 M6 7v10 M18 7v10 M21 9v6 M6 12h12",
  goals: "M12 3l8 9-8 9-8-9z M12 8v8 M8 12h8",
  settings: "M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
};
function NavIcon({ icon }: { icon: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d={iconPaths[icon]} /></svg>;
}
function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav aria-label="Main navigation" className="wellness-nav space-y-1">
    {navItems.map(item => {
      const active = item.href === pathname || (item.href === "/meals" && pathname === "/recipes");
      return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
        className={`wellness-nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "aura-nav-active" : ""}`}>
        {item.href === "/coach" ? <CoachNavIcon /> : <NavIcon icon={item.icon} />}<span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}
function Brand() {
  return <Link href="/dashboard" className="wellness-brand flex items-center gap-3">
    <Image src="/khalories-brand-original-leaf.png" alt="Khalories AI logo" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
    <span><strong className="block text-lg font-extrabold leading-none tracking-tight">Khalories AI</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.18em] opacity-65">Better every day</span></span>
  </Link>;
}
function CoachNavIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
    <path d="M12 2.5 14.1 9.9 21.5 12l-7.4 2.1L12 21.5l-2.1-7.4L2.5 12l7.4-2.1L12 2.5Z" />
    <path d="M19 2.5v4 M17 4.5h4" />
  </svg>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/auth")) clearAuraConversation();
  }, [pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAppRoute = ["/", "/dashboard", "/meals", "/barcode", "/recipes", "/activities", "/reports", "/goals", "/settings", "/coach"].includes(pathname);
  if (!isAppRoute) {
    return <>{children}</>;
  }
  const pageTitle = pathname === "/dashboard" ? "Overview" : pathname === "/" || pathname === "/barcode" ? "Log Food" : pathname === "/meals" ? "Meal History" : pathname === "/recipes" ? "Recipes & Favorites" : pathname === "/reports" ? "Reports" : pathname === "/goals" ? "Goals" : pathname === "/activities" ? "Activities" : pathname === "/settings" ? "Settings" : "AI Coach";
  return <div className="aura-app wellness-app min-h-screen w-full">
    <aside className="aura-sidebar wellness-sidebar fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col p-5 lg:flex">
      <Brand />
      <p className="mt-11 mb-3 pl-3 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#8ca998]">Your space</p>
      <Navigation pathname={pathname} />
      <div className="wellness-sidebar-note mt-auto rounded-2xl p-4"><span className="text-2xl" aria-hidden="true">✳</span><p className="mt-2 text-sm font-bold">Small steps, big progress.</p><p className="mt-2 text-xs leading-5 opacity-75">One meal, one healthy habit, one day at a time.</p></div>
    </aside>
    <div className="min-w-0 lg:pl-[252px]">
      <header className="aura-header wellness-header sticky top-0 z-20 border-b px-4 sm:px-7">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3">
          <button type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-controls="mobile-app-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} className="wellness-menu-button flex h-10 w-10 items-center justify-center rounded-xl border lg:hidden">
            <span aria-hidden="true">{mobileOpen ? "✕" : "☰"}</span>
          </button>
          <Image src="/khalories-brand-original-leaf.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain lg:hidden" />
          <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[.15em] opacity-60">Personal wellness space</p><p className="truncate text-sm font-bold">{pageTitle}</p></div>
          <ThemeToggle /><AccountMenu />
        </div>
        <div id="mobile-app-navigation" className={`wellness-mobile-menu border-t p-3 lg:hidden ${mobileOpen ? "block" : "hidden"}`}>
          <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      </header>
      <div className="min-h-[calc(100vh-72px)] pb-20 lg:pb-0">{children}
          {/* Phase U11: optional beginner spotlight tour, no AI requests */}
          <BeginnerTour /></div>
    </div>
    <nav aria-label="Mobile primary navigation" className="wellness-bottom-nav fixed inset-x-0 bottom-0 z-30 flex h-[70px] justify-around border-t lg:hidden">
      {bottomItems.map(item => { const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-bold ${active ? "wellness-bottom-active" : ""}`}>{item.href === "/coach" ? <CoachNavIcon /> : <NavIcon icon={item.icon} />}<span>{item.label}</span></Link>; })}
    </nav>
    <AuraFloatingCoach />
  </div>;
}
