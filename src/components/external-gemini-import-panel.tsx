"use client";

import { useEffect, useRef, useState } from "react";
import type { FoodAnalysis } from "@/lib/food-analysis";
import type { ManualFoodInput } from "@/lib/manual-food";
import { parseSmartWebFoodPaste } from "@/lib/ai-web-smart-paste.q413d";
import {
  applySmartFoodReference,
  findLocalSmartReferences,
  readCatalogSmartReferences,
  type SmartFoodReference,
  type SmartFillMode,
} from "@/lib/ai-web-smart-reference";
import {
  ADVANCED_NUTRIENT_FIELDS,
  EXTERNAL_AI_SITES,
  EXTERNAL_WEB_FOOD_PROMPT,
  makeReviewedExternalFoodAnalysis,
  type ExternalAiSiteId,
} from "@/lib/external-gemini-import";

type Props = {
  onResult: (result: FoodAnalysis) => void;
  onReset: () => void;
  thumbnailFile: File | null;
  onThumbnailChange: (file: File | null) => void;
};
const COLUMNS = [
  ["name", "Food name"],
  ["grams", "Serving weight (g)"],
  ["calories", "Calories (kcal)"],
  ["protein", "Protein (g)"],
  ["carbs", "Carbs (g)"],
  ["fat", "Fat (g)"],
] as const;

/** Kept under the original component name so the installed Photo Scanner needs no refactor. */
export function ExternalGeminiImportPanel({ onResult, onReset, thumbnailFile, onThumbnailChange }: Props) {
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!thumbnailFile) { setThumbnailPreview(null); return; }
    const url = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnailFile]);
  const [siteId, setSiteId] = useState<ExternalAiSiteId>("gemini");
  const site = EXTERNAL_AI_SITES.find(s => s.id === siteId) ?? EXTERNAL_AI_SITES[0];
  const [pastedResponse, setPastedResponse] = useState("");
  const [items, setItems] = useState<ManualFoodInput[] | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceQueries, setReferenceQueries] = useState<Record<number, string>>({});
  const [catalogResults, setCatalogResults] = useState<Record<number, SmartFoodReference[]>>({});
  const [catalogBusy, setCatalogBusy] = useState<Record<number, boolean>>({});
  const [catalogMessages, setCatalogMessages] = useState<Record<number, string>>({});
  const [netWeightConfirmed, setNetWeightConfirmed] = useState<Record<number, boolean>>({});
  const [referenceNotes, setReferenceNotes] = useState<Record<number, string>>({});
  const catalogRequests = useRef<Record<number, AbortController>>({});

  function cancelCatalogRequests() {
    for (const controller of Object.values(catalogRequests.current)) controller.abort();
    catalogRequests.current = {};
  }

  function resetReferences() {
    cancelCatalogRequests();
    setReferenceQueries({});
    setCatalogResults({});
    setCatalogBusy({});
    setCatalogMessages({});
    setNetWeightConfirmed({});
    setReferenceNotes({});
  }

  function chooseSite(id: ExternalAiSiteId) {
    if (id === siteId) return;
    onReset();
    onThumbnailChange(null);
    resetReferences();
    setSiteId(id);
    setItems(null);
    setPastedResponse("");
    setNotes("");
    setNotice(null);
    setError(null);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(EXTERNAL_WEB_FOOD_PROMPT);
      setNotice(`Prompt copied. Open ${site.name}, upload your food photo there if its chat allows it, then paste the prompt.`);
      setError(null);
    } catch {
      setError("Clipboard access was blocked. Expand the prompt and copy it manually.");
    }
  }

  function importReply(source: string) {
    try {
      const imported = parseSmartWebFoodPaste(source);
      onReset();
      onThumbnailChange(null);
      resetReferences();
      setItems(imported.items);
      setNotes(imported.notes);
      setError(null);
      setNotice(imported.format === "plain-text"
        ? "Smart Paste extracted labeled nutrition locally (no AI API). Check every value and confirm portion weight; missing data stays blank."
        : "Imported structured nutrition locally. Review all values and confirm portions before saving.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The pasted nutrition could not be read.");
    }
  }

  async function importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setPastedResponse(text);
      importReply(text);
    } catch {
      setError("Clipboard reading was blocked or empty. Paste the response into the text box and select Smart Paste & Autofill.");
    }
  }

  function updateFood(index: number, key: keyof ManualFoodInput, value: string) {
    onReset();
    setItems(current => current?.map((item, i) => i === index ? { ...item, [key]: value } : item) ?? null);
    if (key === "grams") setNetWeightConfirmed(current => ({ ...current, [index]: false }));
    if (key === "name") setReferenceQueries(current => ({ ...current, [index]: value }));
    // A user edit makes the earlier reference provenance outdated until re-applied.
    setReferenceNotes(current => ({ ...current, [index]: "" }));
    setNotice(null);
  }

  async function searchCatalog(index: number, query: string) {
    const clean = query.trim().slice(0, 60);
    if (clean.length < 3) {
      setCatalogMessages(current => ({ ...current, [index]: "Enter at least 3 characters to search the catalog." }));
      return;
    }
    catalogRequests.current[index]?.abort();
    const controller = new AbortController();
    catalogRequests.current[index] = controller;
    setCatalogBusy(current => ({ ...current, [index]: true }));
    setCatalogMessages(current => ({ ...current, [index]: "" }));
    setCatalogResults(current => ({ ...current, [index]: [] }));
    try {
      // Existing authenticated food-catalog route; no AI inference or AI credit.
      const response = await fetch(`/api/food/catalog?q=${encodeURIComponent(clean)}`, {
        signal: controller.signal, cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok) throw new Error(response.status === 429
        ? "Food catalog is rate-limited. Try the built-in references or search later."
        : "Catalog unavailable. The built-in references and manual edits still work.");
      const data: unknown = await response.json();
      const found = readCatalogSmartReferences(data);
      if (controller.signal.aborted) return;
      setCatalogResults(current => ({ ...current, [index]: found }));
      setCatalogMessages(current => ({ ...current, [index]: found.length
        ? "Choose the exact product or preparation; these are suggestions, not verified matches."
        : "No catalog reference found. Try a different name or use manual entry." }));
    } catch (issue) {
      if (controller.signal.aborted) return;
      setCatalogMessages(current => ({ ...current, [index]: issue instanceof Error ? issue.message : "Catalog search failed." }));
    } finally {
      if (catalogRequests.current[index] === controller) {
        delete catalogRequests.current[index];
        setCatalogBusy(current => ({ ...current, [index]: false }));
      }
    }
  }

  function fillFromReference(index: number, reference: SmartFoodReference, mode: SmartFillMode) {
    const current = items?.[index];
    if (!current) return;
    try {
      const { item, filled } = applySmartFoodReference(current, reference, netWeightConfirmed[index] === true, mode);
      if (!filled.length) {
        setCatalogMessages(messages => ({ ...messages, [index]: "No new fields to fill. Reference did not report additional nutrients, or the values are already entered." }));
        return;
      }
      onReset();
      setItems(rows => rows?.map((row, i) => i === index ? item : row) ?? null);
      setReferenceNotes(notes => ({ ...notes, [index]: `${reference.name}${reference.brand ? ` (${reference.brand})` : ""}, ${reference.source}; scaled to ${item.grams} g confirmed net weight; ${mode === "replace" ? "available values replaced" : "empty values filled"}.` }));
      setCatalogMessages(messages => ({ ...messages, [index]: `${filled.length} nutrition field(s) ${mode === "replace" ? "updated" : "filled"} from the selected reference. Review before saving.` }));
      setError(null);
      setNotice("Nutrition updated from your chosen reference. Continue reviewing before saving.");
    } catch (issue) {
      setCatalogMessages(messages => ({ ...messages, [index]: issue instanceof Error ? issue.message : "Reference could not be applied." }));
    }
  }

  function selectThumbnail(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 15 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP image smaller than 15 MB for Meal History.");
      return;
    }
    onReset(); // Changing a photo invalidates the prior Save Meal review.
    onThumbnailChange(file);
    setError(null);
    setNotice("Meal History photo ready. Review the meal again, then choose Save photo in the final confirmation.");
  }

  function removeThumbnail() {
    onReset();
    onThumbnailChange(null);
    setNotice("Meal History photo removed. Your nutrition values are unchanged.");
  }

  function reviewResult() {
    if (!items) return;
    try {
      const usedReferences = Object.values(referenceNotes).filter(Boolean).join(" ").slice(0, 650);
      const result = makeReviewedExternalFoodAnalysis({
        items,
        notes: [notes, usedReferences ? `User-selected nutrition references: ${usedReferences}` : ""].filter(Boolean).join(" ").slice(0, 1350),
      }, siteId);
      onResult(result);
      setError(null);
      setNotice("Ready for final review and Add Meal. This import did not use a Khalories AI credit.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Fix the food values before continuing.");
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6" aria-label="External AI Web nutrition import">
      <h3 className="text-lg font-extrabold text-emerald-950">AI Web Import</h3>
      <p className="mt-1 text-sm text-slate-600">Use an AI website you already have access to, then paste its normal answer, table, bullet list or JSON. Smart Paste extracts labeled nutrition without Khalories AI credits.</p>
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
        <label htmlFor="external-ai-site" className="block text-sm font-semibold text-emerald-950">Choose an AI website</label>
        <select id="external-ai-site" value={siteId} onChange={event => chooseSite(event.target.value as ExternalAiSiteId)} className="mt-2 w-full cursor-pointer rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-950">
          {EXTERNAL_AI_SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="mt-2 text-xs text-emerald-900">{site.note}</p>
      </div>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">Khalories never uploads your photo to this website automatically. You choose what to share with {site.name}. External websites may require accounts or have their own limits. We cannot read their chats automatically.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void copyPrompt()} className="cursor-pointer rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100">1. Copy nutrition prompt</button>
        <a href={site.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-emerald-800">2. Open {site.name} in new tab ↗</a>
      </div>
      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700">View or manually copy the nutrition prompt</summary>
        <textarea aria-label="External AI nutrition prompt" readOnly value={EXTERNAL_WEB_FOOD_PROMPT} rows={9} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700" />
      </details>
      <label htmlFor="external-ai-response" className="mt-5 block text-sm font-semibold text-slate-800">3. Paste {site.name}&apos;s answer — no JSON needed</label>
      <textarea id="external-ai-response" value={pastedResponse} onChange={event => { onReset(); onThumbnailChange(null); setPastedResponse(event.target.value); setItems(null); setNotice(null); }} maxLength={30000} rows={6} spellCheck={false} placeholder={"Food: Dry rolled oats\nServing weight: 70.6 g (net, if confirmed)\nCalories: 265 kcal\nProtein: 9 g\nCarbs: 48 g\nFat: 5 g\nFiber: 7 g\nSodium: 3 mg\n\nOr paste any normal AI explanation, Markdown table, or JSON."} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => importReply(pastedResponse)} disabled={!pastedResponse.trim()} className="w-full cursor-pointer rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">Smart Paste &amp; Autofill</button>
        <button type="button" onClick={() => void importFromClipboard()} className="w-full cursor-pointer rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Paste from clipboard &amp; autofill</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}
      {items && (
        <div className="mt-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">4. Review and correct all values</h4>
          <p className="text-xs text-slate-600">Smart Paste reads only explicit labeled values; it cannot independently understand the photo. Unknown nutrients are blank, not zero. Calories are required unless all three macros are known. Check serving weight and nutrition labels before saving.</p>
          {items.map((item, i) => (
            <fieldset key={i} className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-700">Food {i + 1}</legend>
              <div className="grid grid-cols-2 gap-3">
                {COLUMNS.map(([key, label]) => (
                  <label key={key} className={key === "name" ? "col-span-2 text-xs font-medium text-slate-700" : "text-xs font-medium text-slate-700"}>
                    {label}
                    <input type={key === "name" ? "text" : "number"} min={key === "name" ? undefined : "0"} step={key === "name" ? undefined : "any"} maxLength={key === "name" ? 120 : undefined} value={item[key]} onChange={event => updateFood(i, key, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
                  </label>
                ))}
              </div>
              <details className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Advanced nutrients ({ADVANCED_NUTRIENT_FIELDS.filter(([key]) => item[key]?.trim()).length}/{ADVANCED_NUTRIENT_FIELDS.length} available)</summary>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ADVANCED_NUTRIENT_FIELDS.map(([key, label]) => (
                    <label key={key} className="text-xs font-medium text-slate-700">
                      {label}
                      <input type="number" min="0" step="any" value={item[key] ?? ""} onChange={event => updateFood(i, key, event.target.value)} placeholder="Unknown" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
                    </label>
                  ))}
                </div>
              </details>
              <details className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <summary className="cursor-pointer text-sm font-bold text-emerald-950">Smart Nutrition Autofill · Verified weight + food reference</summary>
                <p className="mt-2 text-xs leading-5 text-slate-700">No AI credits. Choose the exact food/preparation yourself: a generic USDA entry is not the same as a branded product. Reference values are per 100 g and are scaled only after you confirm net food weight.</p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-950">
                  <input type="checkbox" checked={netWeightConfirmed[i] === true} onChange={event => {
                    onReset();
                    setNetWeightConfirmed(current => ({ ...current, [i]: event.target.checked }));
                    setNotice(null);
                  }} className="mt-1 size-4 accent-emerald-700" />
                  <span>I confirm the weight above is the edible food only, with bowl, wrap and packaging excluded (or scale tared). If not, edit the weight first.</span>
                </label>
                <p className="mt-1 text-xs text-amber-800">If the scale wasn't tared or you're unsure, do not confirm yet. We can't infer bowl weight from the image.</p>
                <label className="mt-3 block text-xs font-semibold text-slate-800">Find a nutrition reference
                  <input type="search" value={referenceQueries[i] ?? item.name} onChange={event => {
                    const value = event.target.value;
                    catalogRequests.current[i]?.abort();
                    setCatalogResults(current => ({ ...current, [i]: [] }));
                    setReferenceQueries(current => ({ ...current, [i]: value }));
                    setCatalogMessages(current => ({ ...current, [i]: "" }));
                  }} maxLength={60} placeholder="e.g. oats, banana, exact package name" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <p className="mt-3 text-xs font-bold text-slate-700">Built-in USDA references (offline)</p>
                <div className="mt-2 space-y-2">
                  {findLocalSmartReferences(referenceQueries[i] ?? item.name).slice(0, 5).map(reference => (
                    <div key={reference.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">{reference.name}</p>
                      <p className="mt-1 text-xs text-slate-600">{reference.source} · {reference.per100g.calories ?? "Unknown"} kcal / 100 g</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={!netWeightConfirmed[i]} onClick={() => fillFromReference(i, reference, "missing")} className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Fill missing values</button>
                        <button type="button" disabled={!netWeightConfirmed[i]} onClick={() => fillFromReference(i, reference, "replace")} className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">Use reference values instead</button>
                      </div>
                    </div>
                  ))}
                  {findLocalSmartReferences(referenceQueries[i] ?? item.name).length === 0 && <p className="text-xs text-slate-600">No built-in match. Try a simpler food name or search the catalog below.</p>}
                </div>
                <button type="button" disabled={catalogBusy[i] === true} onClick={() => void searchCatalog(i, referenceQueries[i] ?? item.name)} className="mt-3 cursor-pointer rounded-lg border border-emerald-400 bg-white px-3 py-2 text-xs font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">{catalogBusy[i] ? "Searching food catalog..." : "Search existing food catalog"}</button>
                <p className="mt-1 text-xs text-slate-500">Catalog lookup may use Open Food Facts and its own rate limits, but no AI provider or Khalories AI credits.</p>
                {(catalogResults[i] ?? []).map(reference => (
                  <div key={reference.id} className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">{reference.name}{reference.brand ? ` · ${reference.brand}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-600">{reference.source} · {reference.per100g.calories ?? "Unknown"} kcal / 100 g</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={!netWeightConfirmed[i]} onClick={() => fillFromReference(i, reference, "missing")} className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Fill missing values</button>
                      <button type="button" disabled={!netWeightConfirmed[i]} onClick={() => fillFromReference(i, reference, "replace")} className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">Use reference values instead</button>
                    </div>
                  </div>
                ))}
                {catalogMessages[i] && <p role="status" className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-700">{catalogMessages[i]}</p>}
                {referenceNotes[i] && <p className="mt-2 text-xs text-emerald-900">Applied: {referenceNotes[i]}</p>}
              </details>
            </fieldset>
          ))}
          {notes && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{site.name}&apos;s notes: {notes}</p>}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3" aria-label="Optional Meal History thumbnail">
            <h4 className="text-sm font-bold text-emerald-950">Optional photo for Meal History</h4>
            <p className="mt-1 text-xs text-slate-700">Add one food photo to show as the saved meal thumbnail. It stays in Khalories, not the external AI chat. Nothing is uploaded until you select Save photo and confirm saving the meal.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {thumbnailPreview && (
                <img src={thumbnailPreview} alt="Selected Meal History thumbnail preview" className="h-20 w-20 rounded-xl border border-emerald-200 bg-white object-cover" />
              )}
              <label htmlFor="web-import-meal-thumbnail" className="inline-flex cursor-pointer items-center rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 focus-within:ring-2 focus-within:ring-emerald-500">
                {thumbnailFile ? "Replace photo" : "Upload food photo"}
                <input id="web-import-meal-thumbnail" aria-label="Upload optional Meal History thumbnail" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
                  selectThumbnail(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }} />
              </label>
              {thumbnailFile && <button type="button" onClick={removeThumbnail} className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Remove photo</button>}
            </div>
            {thumbnailFile && <p role="status" className="mt-2 break-all text-xs text-emerald-900">Selected: {thumbnailFile.name} · saved only with your opt-in. The existing thumbnail processor compresses it before private storage.</p>}
            <p className="mt-2 text-xs text-slate-500">JPG, PNG or WebP, up to 15 MB. Saving the meal without a photo is always allowed.</p>
          </div>
          <button type="button" onClick={reviewResult} className="w-full cursor-pointer rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800">5. Review meal &amp; continue to Save</button>
        </div>
      )}
    </section>
  );
}
