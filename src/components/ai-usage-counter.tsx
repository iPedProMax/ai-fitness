"use client";

import { useEffect, useState } from "react";
import type { AiUsageStatus } from "@/lib/ai-usage";

export function AiUsageCounter() {
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/ai/usage", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to read quota");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" ||
            !("remaining" in data) || typeof data.remaining !== "number" ||
            !("limit" in data) || typeof data.limit !== "number") {
          throw new Error("Unexpected quota response");
        }
        if (!controller.signal.aborted) setUsage(data as AiUsageStatus);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <section aria-label="Daily AI analysis allowance"
      className="mt-7 mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Your daily AI analyses</h2>
          <p className="mt-1 text-sm text-slate-600">
            Photo and AI text analyses share 20 free uses. Resets at midnight Philippine time.
          </p>
        </div>
        <p className="text-lg font-extrabold text-emerald-800" aria-live="polite">
          {usage ? `${usage.remaining} / ${usage.limit} left` : failed ? "Unavailable" : "Loading..."}
        </p>
      </div>
      {usage && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100"
          role="progressbar" aria-label="Daily AI analyses remaining"
          aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.remaining}>
          <div className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${usage.limit ? (100 * usage.remaining) / usage.limit : 0}%` }} />
        </div>
      )}
      {usage?.remaining === 0 && (
        <p className="mt-2 text-sm font-semibold text-slate-700">Daily allowance used. Manual food entry is still free.</p>
      )}
      {failed && <p className="mt-2 text-xs text-slate-600">Could not load your remaining AI analyses. Try refreshing.</p>}
    </section>
  );
}