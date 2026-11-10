/** Pure aggregation of preselected, non-identifying operations fields. */
export type DailyCredits = { day: string; analyses: number; refinements: number };
export type ProviderWindow = { provider: string; requests: number; tokens: number };
export type RequestOutcomes = { completed: number; errors: number; timeouts: number; running: number };

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function count(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function aggregateDailyCredits(rows: unknown, days: string[]): DailyCredits[] | null {
  if (!Array.isArray(rows) || !days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
  const map = new Map(days.map(day => [day, { day, analyses: 0, refinements: 0 }]));
  for (const item of rows) {
    const row = object(item);
    if (!row || typeof row.usage_date !== "string") return null;
    const analyses = count(row.analyses_used); const refinements = count(row.refinements_used);
    if (analyses === null || refinements === null) return null;
    const day = map.get(row.usage_date);
    if (day) { day.analyses += analyses; day.refinements += refinements; }
  }
  return days.map(day => map.get(day)!);
}

export function aggregateProviderWindows(rows: unknown): ProviderWindow[] | null {
  if (!Array.isArray(rows)) return null;
  const byProvider = new Map<string, ProviderWindow>();
  for (const item of rows) {
    const row = object(item);
    if (!row || typeof row.provider !== "string" || !/^[a-z0-9.-]{1,64}$/.test(row.provider)) return null;
    const requests = count(row.requests); const tokens = count(row.tokens);
    if (requests === null || tokens === null) return null;
    const prior = byProvider.get(row.provider) ?? { provider: row.provider, requests: 0, tokens: 0 };
    prior.requests += requests; prior.tokens += tokens;
    if (!Number.isSafeInteger(prior.requests) || !Number.isSafeInteger(prior.tokens)) return null;
    byProvider.set(row.provider, prior);
  }
  return [...byProvider.values()].sort((a,b) => b.requests - a.requests || a.provider.localeCompare(b.provider));
}

export function summarizeRequestOutcomes(rows: unknown): RequestOutcomes | null {
  if (!Array.isArray(rows)) return null;
  const result: RequestOutcomes = { completed: 0, errors: 0, timeouts: 0, running: 0 };
  for (const item of rows) {
    const row = object(item);
    if (!row || (row.state !== "running" && row.state !== "complete")) return null;
    if (row.state === "running") { result.running++; continue; }
    result.completed++;
    if (row.response_status === null) continue;
    const status = count(row.response_status);
    if (status === null || status < 200 || status > 599) return null;
    if (status >= 400) result.errors++;
    if (status === 504) result.timeouts++;
  }
  return result;
}
