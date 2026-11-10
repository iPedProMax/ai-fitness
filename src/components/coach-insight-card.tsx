import Link from "next/link";
import { readCoachUserSummary } from "@/lib/coach-user-context";
import { coachDailyNudge } from "@/lib/coach-insights";

/** Inexpensive rule-based insight. No model call or AI credit spent on render. */
export async function CoachInsightCard() {
  const summary = await readCoachUserSummary();
  return <section className="wellness-insight-card" aria-label="Coach FONZ daily insight">
    <div className="wellness-insight-label">✦ COACH FONZ INSIGHT</div>
    <p>{summary ? coachDailyNudge(summary) : "Your daily insights will appear here when your saved logs are available."}</p>
    <Link href="/coach">Explore suggestions ↗</Link>
    <span className="wellness-insight-plant" aria-hidden="true">✳</span>
  </section>;
}
