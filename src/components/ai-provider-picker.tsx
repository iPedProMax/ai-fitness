"use client";

import { useEffect, useState } from "react";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { SHARED_TEXT_AI_PROVIDERS } from "@/lib/ai/shared-text-roster";
import { getProviderMaxImages, type AiProviderChoice } from "@/lib/ai/provider-image-limits";

export type { AiProviderChoice } from "@/lib/ai/provider-image-limits";
const visionChoices: { id: AiProviderChoice; label: string }[] = [
  { id: "gemini", label: "Google Gemini · primary" },
  { id: "groq", label: "Groq Qwen Vision · 2 photos" },
  { id: "cloudflare", label: "Cloudflare Workers AI · 1 photo" },
  { id: "zai", label: "Z.ai GLM Vision (2 photos)" },
  { id: "openrouter", label: "OpenRouter Free Vision (1 photo)" },
];

const textChoices: { id: AiProviderChoice; label: string }[] = ([
  { id: "cerebras", label: "Cerebras Text" },
  { id: "siliconflow", label: "SiliconFlow Text" },
  { id: "huggingface", label: "Hugging Face Text" },
  { id: "mistral", label: "Mistral Text" },
  { id: "ollama-local", label: "Ollama Local (dev only)" },
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
        {choices.filter(choice => choice.id === value || (mode === "manual" && choice.id === "ollama-local" && localTextReady) || choice.id === "gemini" || statuses?.find(item => item.id === choice.id)?.enabled === true).map(choice => {
          const entry = statuses?.find(item => item.id === choice.id);
          // Existing default remains available when status fetch fails; server always rechecks.
          const permitted = (mode === "manual" && choice.id === "ollama-local" && localTextReady)
            || (mode === "photo" && choice.id === "gemini") || entry?.enabled === true;
          return <option key={choice.id} value={choice.id} disabled={!permitted}>{choice.label}{!permitted ? " (unavailable)" : ""}</option>;
        })}
      </select>
      <p role="status" className="mt-2 text-xs text-slate-600">
        {!supported && ["openrouter", "zai", "siliconflow", "huggingface", "cerebras"].includes(value) ? "This AI is for manual text estimates and coaching, not meal photos."
          : !supported ? value === "groq" ? "Groq supports up to two photos per request. Remove extras or choose Gemini."
          : value === "mistral" ? "Mistral supports one photo. Choose Gemini for multiple photos."
          : value === "ollama-local" ? "Local Ollama supports one photo and runs only on your development PC."
          : "Cloudflare currently supports one photo per request. Choose Gemini for multiple photos."
          : mode === "manual" && value === "ollama-local" && localTextReady ? "Ollama Text runs only on your development PC. No cloud AI credits." : mode === "manual" && status?.enabled !== true ? "No text AI is available yet. You can still log food manually without AI."
          : status?.enabled === false ? (status.reason ?? "This provider is unavailable right now.")
          : "Only the selected provider is used. No automatic switching or paid fallback."}
      </p>
    </div>
  );
}
