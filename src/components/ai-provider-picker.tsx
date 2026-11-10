"use client";

import { useEffect, useState } from "react";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "@/lib/ai/shared-text-roster";
import { getProviderMaxImages, type AiProviderChoice } from "@/lib/ai/provider-image-limits";

export type { AiProviderChoice } from "@/lib/ai/provider-image-limits";
const visionChoices: { id: AiProviderChoice; label: string }[] = [
  { id: "gemini", label: "Google Gemini · primary · up to 10 photos" },
  { id: "groq", label: "Groq Qwen Vision · 2 photos" },
  { id: "cloudflare-vision", label: "Cloudflare Moondream · experimental · 1 photo" },
  { id: "zai-vision", label: "Z.ai GLM Vision · experimental · 2 photos" },
  { id: "openrouter-vision", label: "OpenRouter Free Vision · experimental · 1 photo" },
];

const textChoices: { id: AiProviderChoice; label: string }[] = ([
  { id: "cerebras", label: "Cerebras Text" },
  { id: "siliconflow", label: "SiliconFlow Text" },
  { id: "huggingface", label: "Hugging Face Text" },
  { id: "mistral", label: "Mistral Text" },
  { id: "ollama-local", label: "Ollama Local (dev only)" },
  { id: "cloudflare", label: "Cloudflare Llama Scout · Text" },
  { id: "openrouter", label: "OpenRouter Free · Text" },
  { id: "zai", label: "Z.ai GLM · Text" },
] as { id: AiProviderChoice; label: string }[]).filter(choice => SHARED_TEXT_AI_PROVIDERS.includes(choice.id));

export function AiProviderPicker({ value, onChange, photoCount = 0, mode = "photo" }: {
  value: AiProviderChoice; onChange: (next: AiProviderChoice) => void; photoCount?: number; mode?: "photo" | "manual";
}) {
  const [statuses, setStatuses] = useState<AiModelStatus[] | null>(null);
  const [localTextReady, setLocalTextReady] = useState(false);
  useEffect(() => {
    if (mode !== "manual") { setLocalTextReady(false); return; }
    const controller = new AbortController();
    fetch("/api/coach/local", { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setLocalTextReady(data?.available === true); })
      .catch(() => { if (!controller.signal.aborted) setLocalTextReady(false); });
    return () => controller.abort();
  }, [mode]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && Array.isArray(data?.models)) setStatuses(data.models); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const choices = mode === "photo" ? visionChoices : textChoices;
  useEffect(() => {
    if (mode === "photo" && !visionChoices.some(choice => choice.id === value)) {
      onChange("gemini");
    }
  }, [mode, value, onChange]);
  const selected = choices.find(choice => choice.id === value);
  const supported = mode === "manual" || (selected != null && photoCount <= getProviderMaxImages(selected.id));
  const status = statuses?.find(item => item.id === value);
  // Khalories Phase U6: provider selector parity: only correct a disabled selection AFTER successful status fetch.
  const nextTextProvider = mode === "manual"
    ? textChoices.find(choice => statuses?.some(item =>
        item.id === choice.id && item.enabled === true && item.text === true))?.id
    : undefined;
  useEffect(() => {
    if (mode !== "manual" || !statuses || !nextTextProvider) return;
    const existing = statuses.find(item => item.id === value);
    if (existing?.enabled === true && existing.text === true) return;
    if (nextTextProvider !== value) onChange(nextTextProvider);
  }, [mode, statuses, nextTextProvider, value, onChange]);

  return (
    <div className="mx-auto mb-5 max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="ai-provider-choice" className="block text-sm font-semibold text-slate-800">{mode === "photo" ? "Vision AI provider" : "Text AI provider"}</label>
      <select id="ai-provider-choice" value={value}
        onChange={event => onChange(event.target.value as AiProviderChoice)}
        className="mt-2 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
        {(mode === "manual" ? choices : choices.filter(choice => choice.id === value || choice.id === "gemini" || statuses?.find(item => item.id === choice.id)?.enabled === true)).map(choice => {
          const entry = statuses?.find(item => item.id === choice.id);
          // Existing default remains available when status fetch fails; server always rechecks.
          const permitted = mode === "manual"
            ? entry?.enabled === true && entry.text === true && (choice.id !== "ollama-local" || localTextReady)
            : choice.id === "gemini" || entry?.enabled === true;
          return <option key={choice.id} value={choice.id} disabled={!permitted}>{choice.label}{!permitted ? " (unavailable)" : ""}</option>;
        })}
      </select>
      <p role="status" className="mt-2 text-xs text-slate-600">
        {!supported && ["openrouter", "zai", "siliconflow", "huggingface", "cerebras"].includes(value) ? "This AI is for manual text estimates and coaching, not meal photos."
          : !supported ? value === "groq" ? "Groq supports up to two photos per request. Remove extras or choose Gemini."
          : value === "mistral" ? "Mistral supports one photo. Choose Gemini for multiple photos."
          : value === "zai-vision" ? "Z.ai Vision supports up to two photos. Choose Gemini for more."
          : value === "openrouter-vision" ? "OpenRouter Vision supports one photo. Choose Gemini for more."
          : value === "ollama-local" ? "Local Ollama supports one photo and runs only on your development PC."
          : "Cloudflare currently supports one photo per request. Choose Gemini for multiple photos."
          : mode === "manual" && value === "ollama-local" && localTextReady ? "Ollama Text runs only on your development PC. No cloud AI credits." : mode === "manual" && status?.enabled !== true ? (status?.reason ?? "This Text AI is not approved yet. Manual food logging remains free.")
          : status?.enabled === false ? (status.reason ?? "This provider is unavailable right now.")
          : "Only the selected provider is used. No automatic switching or paid fallback."}
      </p>
      {mode === "manual" && <details className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-emerald-900">Text AI roster · {statuses ? textChoices.filter(choice => statuses.some(item => item.id === choice.id && item.enabled === true && item.text === true && (choice.id !== "ollama-local" || localTextReady))).length : "..."}/{textChoices.length} available</summary>
        <div className="mt-3 space-y-2">{textChoices.map(choice => {
          const item = statuses?.find(status => status.id === choice.id);
          const ready = item?.enabled === true && item.text === true && (choice.id !== "ollama-local" || localTextReady);
          return <div key={choice.id} className="rounded-lg border border-slate-100 bg-white p-3">
            <div className="flex items-center justify-between gap-2"><strong className="text-slate-900">{choice.label}</strong><span className={ready ? "text-xs font-bold text-emerald-700" : "text-xs font-semibold text-slate-500"}>{ready ? "Available" : "Unavailable"}</span></div>
            {!ready && <p className="mt-1 text-xs text-slate-600">{!statuses ? "Checking server status..." : choice.id === "ollama-local" && !localTextReady ? "Local Ollama is not ready on this computer" : item?.reason ?? "Server approval required"}</p>}
          </div>;
        })}</div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Providers need an API key, confirmed free use, and database approval before they can run. No paid fallback. Manual logging is always free.</p>
      </details>}
    </div>
  );
}
