import "server-only";
import { createClient as trustedClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { lastSevenManilaDays } from "@/lib/admin-daily-trends";
import { aggregateDailyCredits, aggregateProviderWindows, summarizeRequestOutcomes,
  type DailyCredits, type ProviderWindow, type RequestOutcomes } from "@/lib/admin-ai-aggregation";

export type ProviderRow = ProviderWindow & {
  enabled: boolean; freeVerified: boolean; cooldownUntil: string | null;
  dailyRequestLimit: number | null;
};
export type AdminAiSummary = {
  status: "ready" | "not_configured";
  generatedAt: string;
  days: DailyCredits[] | null;
  outcomes: RequestOutcomes | null;
  providers: ProviderRow[] | null;
  notices: string[];
};

/** Aggregate-only, read-only analytics. Never return user identifiers or response bodies. */
export async function readAdminAiSummary(): Promise<AdminAiSummary> {
  // Defense in depth: check on every invocation, not only inside the page.
  const access = await getAdminAccess();
  if (!access.isAdmin) throw new Error("Admin authorization required");
  const generatedAt = new Date().toISOString();
  const dates = lastSevenManilaDays(new Date(generatedAt));
  const startManila = `${dates[0]}T00:00:00+08:00`;
  const startUtc = `${dates[0]}T00:00:00Z`;
  const endUtc = new Date(Date.parse(`${dates[6]}T00:00:00Z`) + 86400000).toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { status: "not_configured", generatedAt,
    days: null, outcomes: null, providers: null, notices: ["Server-only accounting access is not configured."] };

  const client = trustedClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Explicit columns: no email, user_id, request_key, response_body, or prompts.
  const [dailyResult, requestResult, providerResult, policyResult] = await Promise.allSettled([
    client.from("ai_daily_usage").select("usage_date,analyses_used,refinements_used")
      .gte("usage_date", dates[0]).lte("usage_date", dates[6]).order("usage_date", { ascending: false }).limit(1001),
    client.from("ai_requests").select("created_at,state,response_status")
      .gte("created_at", startManila).order("created_at", { ascending: false }).limit(1001),
    client.from("ai_provider_usage").select("provider,requests,tokens")
      .eq("window_kind", "day").gte("window_start", startUtc).lt("window_start", endUtc)
      .order("window_start", { ascending: false }).limit(1001),
    client.from("ai_provider_policy").select("provider,enabled,free_tier_verified,cooldown_until,requests_per_day"),
  ] as const);

  const settled = <T,>(value: PromiseSettledResult<T>): T | null => value.status === "fulfilled" ? value.value : null;
  const dailyRaw = settled(dailyResult); const requestRaw = settled(requestResult);
  const providerRaw = settled(providerResult); const policyRaw = settled(policyResult);
  const notices: string[] = [];
  const usable = (result: { error: unknown; data: unknown[] | null } | null, label: string) => {
    if (!result || result.error || !result.data) { notices.push(`${label} unavailable; check database permissions or schema.`); return null; }
    if (result.data.length >= 1001) { notices.push(`${label} exceeds the 1,000-row accuracy limit; totals are withheld rather than sampled.`); return null; }
    return result.data;
  };
  const dailyRows = usable(dailyRaw, "Daily AI usage");
  const requestRows = usable(requestRaw, "Request outcomes");
  const providerRows = usable(providerRaw, "Provider attempt windows");
  const days = dailyRows ? aggregateDailyCredits(dailyRows, dates) : null;
  const outcomes = requestRows ? summarizeRequestOutcomes(requestRows) : null;
  const attempts = providerRows ? aggregateProviderWindows(providerRows) : null;
  if (dailyRows && !days) notices.push("AI credit counters contained invalid values.");
  if (requestRows && !outcomes) notices.push("Request status records contained invalid values.");
  if (providerRows && !attempts) notices.push("Provider usage records contained invalid values.");
  let providers: ProviderRow[] | null = null;
  if (!policyRaw || policyRaw.error || !Array.isArray(policyRaw.data)) {
    notices.push("Provider configuration unavailable.");
  } else if (attempts) {
    const totals = new Map(attempts.map(item => [item.provider, item]));
    providers = [];
    for (const raw of policyRaw.data) {
      if (typeof raw.provider !== "string") continue;
      const usage = totals.get(raw.provider) ?? { provider: raw.provider, requests: 0, tokens: 0 };
      providers.push({ ...usage, enabled: raw.enabled === true, freeVerified: raw.free_tier_verified === true,
        cooldownUntil: typeof raw.cooldown_until === "string" ? raw.cooldown_until : null,
        dailyRequestLimit: Number.isSafeInteger(raw.requests_per_day) && raw.requests_per_day > 0 ? raw.requests_per_day : null });
      totals.delete(raw.provider);
    }
    for (const usage of totals.values()) providers.push({ ...usage, enabled: false, freeVerified: false, cooldownUntil: null, dailyRequestLimit: null });
    providers.sort((a,b) => b.requests - a.requests || a.provider.localeCompare(b.provider));
  }
  return { status: "ready", generatedAt, days, outcomes, providers, notices };
}
