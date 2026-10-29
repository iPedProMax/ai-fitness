"use client";

import { useEffect, useState } from "react";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { getProviderMaxImages, type AiProviderChoice } from "@/lib/ai/provider-image-limits";

export type { AiProviderChoice } from "@/lib/ai/provider-image-limits";
const choices: { id: AiProviderChoice; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "cloudflare", label: "Cloudflare Workers AI" },
  { id: "groq", label: "GroqCloud (Qwen Vision)" },
  { id: "mistral", label: "Mistral 14B (Experimental)" },
  { id: "ollama-local", label: "Ollama Local (Qwen Vision, dev only)" },
  { id: "openrouter", label: "OpenRouter Free - Text" },
  { id: "zai", label: "Z.ai GLM - Text" },
  { id: "siliconflow", label: "SiliconFlow - Text" },
  { id: "huggingface", label: "Hugging Face - Text" },
  { id: "cerebras", label: "Cerebras Free - Text" },
];

export function AiProviderPicker({ value, onChange, photoCount = 0 }: {
  value: AiProviderChoice; onChange: (next: AiProviderChoice) => void; photoCount?: number;
}) {
  const [statuses, setStatuses] = useState<AiModelStatus[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && Array.isArray(data?.models)) setStatuses(data.models); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const selected = choices.find(choice => choice.id === value)!;
  const supported = photoCount <= getProviderMaxImages(selected.id);
  const status = statuses?.find(item => item.id === value);
  return (
    <div className="mx-auto mb-5 max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="ai-provider-choice" className="block text-sm font-semibold text-slate-800">AI provider</label>
      <select id="ai-provider-choice" value={value}
        onChange={event => onChange(event.target.value as AiProviderChoice)}
        className="mt-2 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
        {choices.map(choice => {
          const entry = statuses?.find(item => item.id === choice.id);
          // Existing default remains available when status fetch fails; server always rechecks.
          const permitted = choice.id === "gemini" || entry?.enabled === true;
          return <option key={choice.id} value={choice.id} disabled={!permitted}>{choice.label}{!permitted ? " (unavailable)" : ""}</option>;
        })}
      </select>
      <p role="status" className="mt-2 text-xs text-slate-600">
        {!supported && ["openrouter", "zai", "siliconflow", "huggingface", "cerebras"].includes(value) ? "This AI is for manual text estimates and coaching, not meal photos."
          : !supported ? value === "groq" ? "Groq supports up to two photos per request. Remove extras or choose Gemini."
          : value === "mistral" ? "Mistral supports one photo. Choose Gemini for multiple photos."
          : value === "ollama-local" ? "Local Ollama supports one photo and runs only on your development PC."
          : "Cloudflare currently supports one photo per request. Choose Gemini for multiple photos."
          : status?.enabled === false ? (status.reason ?? "This provider is unavailable right now.")
          : "Only the selected provider is used. No automatic switching or paid fallback."}
      </p>
    </div>
  );
}
