"use client";

import { useEffect, useState } from "react";
import type { AiUsageStatus } from "@/lib/ai-usage";

/** Display the server's durable balance, never an optimistic local deduction. */
export function AiAnalysisBalance() {
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let newestRequest = 0;
    const refresh = async () => {
      const requestNo = ++newestRequest;
      try {
        const response = await fetch("/api/ai/usage", { cache: "no-store" });
        if (!response.ok) throw new Error("Usage unavailable");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object") throw new Error("Invalid response");
        const data = result as Partial<AiUsageStatus>;
        if (![data.limit, data.used, data.remaining].every(n =>
          typeof n === "number" && Number.isInteger(n) && n >= 0
        )) throw new Error("Invalid usage values");
        if (mounted && requestNo === newestRequest) {
          setUsage(data as AiUsageStatus);
          setFailed(false);
        }
      } catch {
        if (mounted && requestNo === newestRequest) setFailed(true);
      }
    };

    const onRequest = () => { void refresh(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("khalories:ai-usage-changed", onRequest);
    window.addEventListener("focus", onRequest);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      window.removeEventListener("khalories:ai-usage-changed", onRequest);
      window.removeEventListener("focus", onRequest);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <section aria-label="Daily AI credit balance" className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-950">
      <span className="font-semibold">AI analyses today: {usage ? `${usage.used}/${usage.limit} used · ${usage.remaining} left` : failed ? "Balance unavailable" : "Loading balance..."}</span>
      <span className="text-emerald-900/80">AI requests are counted independently of Add Meal. Database lookup and manual entry are free.</span>
    </section>
  );
}
