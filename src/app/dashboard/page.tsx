import { DashboardFoodInsights } from "@/components/dashboard-food-insights";
import Link from "next/link";
import { TodayOverview } from "@/components/today-overview";
import { AdminDashboardLink } from "@/components/admin-dashboard-link";
import { HealthSnapshot } from "@/components/health-snapshot";
import { WaterSummary } from "@/components/water-summary";
import { AiUsageCounter } from "@/components/ai-usage-counter";
import { CoachInsightCard } from "@/components/coach-insight-card";

export default function DashboardPage() {
  return <main className="wellness-dashboard mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
    <TodayOverview />
        <AdminDashboardLink />
        <DashboardFoodInsights />
    <div className="wellness-lower-grid mt-5">
      <div id="water" className="scroll-mt-24"><WaterSummary /></div>
      <CoachInsightCard />
    </div>
    <HealthSnapshot />
    <AiUsageCounter />
    <div className="wellness-more-links mt-6 flex flex-wrap gap-3">
      <Link href="/">＋ Log Food</Link>
      <Link href="/meals">◷ Meal History</Link>
      <Link href="/recipes">♡ My recipes & favorites ↗</Link>
      <Link href="/reports">↗ Daily reports</Link>
      <Link href="/goals">◎ My goals</Link>
    </div>
  </main>;
}
