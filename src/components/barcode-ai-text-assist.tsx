"use client";

import { useEffect, useState } from "react";
import type { AiProviderChoice } from "@/components/ai-provider-picker";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { readyTextAiIds } from "@/lib/ai/text-readiness";
import { analyzeFoodText } from "@/lib/analyze-food-text";
import type { FoodAnalysis } from "@/lib/food-analysis";

type Props = {
  barcode: string;
  initialName: string;
  initialGrams: string;
  preferredProvider: AiProviderChoice | undefined;
  onDraft: (food: FoodAnalysis["foods"][number], productName: string, portionGrams: string) => void;
};

type ModelResponse = { models?: unknown };

/** Text AI only. Barcode digits never establish nutrition facts. */
export function BarcodeAiTextAssist({ barcode, initialName, initialGrams, preferredProvider, onDraft }: Props) {
  const [name, setName] = useState(initialName);
  const [grams, setGrams] = useState(initialGrams);
  const [labelText, setLabelText] = useState("");
  const [statuses, setStatuses] = useState<AiModelStatus[] | null>(null);
  const [localTextReady, setLocalTextReady] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setName(initialName); setGrams(initialGrams); }, [initialName, initialGrams]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? (await response.json()) as ModelResponse : null)
      .then(value => {
        if (controller.signal.aborted) return;
        setStatuses(Array.isArray(value?.models) ? value.models as AiModelStatus[] : []);
      })
      .catch(() => { if (!controller.signal.aborted) setStatuses([]); });
    fetch("/api/coach/local", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(value => { if (!controller.signal.aborted) setLocalTextReady(value?.available === true); })
      .catch(() => { if (!controller.signal.aborted) setLocalTextReady(false); });
    return () => controller.abort();
  }, []);

  // Never display disabled models, and never mistake an installed Ollama model
  // for a ready-to-use server: both policy and the local endpoint must agree.
  const ready = readyTextAiIds(statuses).filter(id => id !== "ollama-local" || localTextReady);
  // Respect the provider selected above the barcode scanner. Never silently
  // fall back to a different provider when server readiness changes.
  const selected = preferredProvider && ready.includes(preferredProvider) ? preferredProvider : undefined;
  const isReady = selected !== undefined;
  const loading = statuses === null;

  async function estimate() {
    const product = name.trim();
    if (working || !selected) return;
    if (product.length < 3 || product.length > 120) {
      setError("Enter a product name and brand (3–120 characters). A barcode alone cannot reveal nutrition.");
      return;
    }
    const amount = Number(grams);
    if (grams.trim() && (!Number.isFinite(amount) || amount < 1 || amount > 2000)) {
      setError("Enter a serving size between 1 and 2,000 grams, or leave it blank.");
      return;
    }
    if (!window.confirm("Use ONE AI analysis credit for an approximate text estimate? Review the suggestions before saving.")) return;
    setWorking(true); setError("");
    try {
      const description = `ONE packaged food: ${product}. ${grams.trim() ? `Actual portion: ${amount} grams.` : "Portion unknown."} Barcode ${barcode} is only an identifier, NOT nutrition evidence. ${labelText.trim() ? `USER-TYPED LABEL OR QR TEXT: ${labelText.trim()}. Use explicit label units where clear, or estimate cautiously.` : "No nutrition label text provided; provide a cautious approximate estimate."} Do not claim to have scanned or verified packaging. Count the portion once.`;
      const result = await analyzeFoodText(description.slice(0, 600), { modelId: selected });
      if (result.foods.length !== 1) throw new Error("Text AI returned more than one item. Describe just one product.");
      onDraft(result.foods[0], product, grams);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Text AI is unavailable. Manual entry remains free.");
    } finally { setWorking(false); }
  }

  const inputStyle = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
  return (
    <section id="barcode-ai-text" aria-label="Text AI nutrition autofill" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">✦</span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 sm:text-base">AI nutrition autofill</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Draft missing calories and macros from a product description. Existing values stay untouched.</p>
          </div>
        </div>
        {isReady && <span className="shrink-0 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700">1 credit only when used</span>}
      </div>

      {loading ? (
        <p role="status" className="mt-3 text-xs text-slate-600">Checking available Text AI providers…</p>
      ) : !isReady ? (
        <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-xs font-semibold text-amber-800">Text AI is not available right now.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">No approved provider is ready for this request. Choose another provider above, or enter nutrition manually for free—no credit is used.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <label className="block text-xs font-semibold text-slate-700">Product and brand
              <input type="text" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="e.g. Nissin Seafood Noodles" className={inputStyle} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Amount eaten (g)
              <input type="number" min="1" max="2000" step="any" value={grams} onChange={e => setGrams(e.target.value)} placeholder="Optional" className={inputStyle} />
            </label>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
            <p className="text-xs font-bold text-emerald-900">Selected Text AI: {statuses?.find(s => s.id === selected)?.name ?? selected}</p>
            <p className="mt-1 text-[11px] text-slate-600">Want another model? Use the provider selector above the barcode scanner. No credit is charged for changing models.</p>
          </div>
          <button type="button" aria-expanded={showOptional} aria-controls="barcode-ai-optional" onClick={() => setShowOptional(v => !v)} className="flex min-h-9 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-emerald-300">
            <span>Extra details (label / QR text) — optional</span>
            <span aria-hidden="true">{showOptional ? "−" : "+"}</span>
          </button>
          {showOptional && <div id="barcode-ai-optional" className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">Copied nutrition-label or decoded QR text
              <textarea value={labelText} rows={2} maxLength={240} onChange={e => setLabelText(e.target.value)} placeholder="e.g. Per 40 g: 180 kcal, 4 g protein, 28 g carbs, 6 g fat" className={inputStyle} />
            </label>

          </div>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-600">Using {statuses?.find(s => s.id === selected)?.name ?? selected}. Suggestions need your review.</p>
            <button type="button" disabled={working || name.trim().length < 3} onClick={() => void estimate()} className="min-h-10 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {working ? "Estimating nutrition…" : "Fill missing values · 1 credit"}
            </button>
          </div>
          {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">{error}</p>}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Estimates are not verified product facts. Nothing is saved until you review and confirm.</p>
    </section>
  );
}
