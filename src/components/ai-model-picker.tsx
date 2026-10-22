"use client";

import { useEffect, useState } from "react";
import { aiModelCatalog, type AiModelId, type AiModelStatus } from "@/lib/ai/model-catalog";

export type AiModelPickerProps = {
  modelId: AiModelId;
  onChange: (model: AiModelId) => void;
  onUsableChange: (usable: boolean) => void;
  photoCount: number;
  disabled?: boolean;
  temporarilyLimited?: readonly AiModelId[];
};

/** All seven appear, but never claim live quota balances that weren't checked.
 * Backend admission rechecks provider and user limits at execution time. */
export function AiModelPicker({ modelId, onChange, onUsableChange, photoCount,
  disabled = false, temporarilyLimited = [] }: AiModelPickerProps) {
  const [models, setModels] = useState<AiModelStatus[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        const result: { models?: AiModelStatus[] } = await response.json();
        if (!Array.isArray(result.models)) throw new Error("Malformed model list");
        setModels(result.models);
        setLoadError(false);
      }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, []);

  const list = aiModelCatalog.map(item => {
    const found = models?.find(m => m.id === item.id);
    const incompatible = photoCount > 0
      ? !item.vision || photoCount > item.maxImages
      : !item.text;
    const limited = temporarilyLimited.includes(item.id);
    const reason = limited ? "Temporarily limited — try later"
      : !found?.enabled ? found?.reason ?? "Checking provider setup"
      : incompatible ? photoCount > 0
        ? `Does not support ${photoCount} uploaded photo${photoCount === 1 ? "" : "s"}`
        : "Does not support text requests"
      : null;
    return { id: item.id, name: item.name, reason, enabled: reason === null };
  });
  const selected = list.find(item => item.id === modelId);
  const usable = !!selected?.enabled && !disabled && !loadError && models !== null;
  useEffect(() => { onUsableChange(usable); }, [usable, onUsableChange]);

  return (
    <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <label htmlFor="ai-model-selection" className="block text-sm font-semibold text-slate-800">
        Choose your AI model
      </label>
      <p className="mt-1 text-xs text-slate-600">
        You choose. We never switch providers without asking. Only verified free models can run.
      </p>
      <select id="ai-model-selection" value={modelId} disabled={disabled || loadError || !models}
        onChange={event => onChange(event.target.value as AiModelId)}
        className="mt-3 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
        {list.map(model => <option key={model.id} value={model.id} disabled={!model.enabled}>
          {model.name}{model.reason ? ` — ${model.reason}` : " — Ready (quota checked on request)"}
        </option>)}
      </select>
      <p role="status" className="mt-2 text-xs text-slate-600">
        {loadError ? "Could not check AI providers. Refresh to retry." : !models ? "Checking AI models…"
          : selected?.reason ?? "Selected model is configured. Free quota is verified when you submit."}
      </p>
    </div>
  );
}
