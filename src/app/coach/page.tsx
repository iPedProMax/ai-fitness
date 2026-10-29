"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { coachReply, coachTopics, type CoachTopic } from "@/lib/coach-guidance";
import { aiModelCatalog, type AiModelId, type AiModelStatus } from "@/lib/ai/model-catalog";
import { recommendedProviders } from "@/lib/ai/provider-roles";
import { submitAiRequest } from "@/lib/ai-submission";

type Message = { id: number; author: "coach" | "you"; text: string };
export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, author: "coach", text: "Welcome! Pick a free guidance topic below, or ask an available AI model a question. Local Ollama uses no cloud AI credits; other chat models use your daily refinement allowance." },
  ]);
  const [model, setModel] = useState<AiModelId>("gemini");
  const [statuses, setStatuses] = useState<AiModelStatus[]>([]);
  const [localAvailable, setLocalAvailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", {signal: controller.signal, cache: "no-store"})
      .then(async res => res.ok ? res.json() : null)
      .then(data => { if (!controller.signal.aborted && Array.isArray(data?.models)) setStatuses(data.models); })
      .catch(() => {});
    // This checks ONLY the localhost AURA adapter. Scanner authorization stays unchanged.
    fetch("/api/coach/local", {signal:controller.signal,cache:"no-store"})
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setLocalAvailable(data?.available === true); })
      .catch(() => { if (!controller.signal.aborted) setLocalAvailable(false); });
    return () => controller.abort();
  }, []);
  function choose(topic: CoachTopic) {
    const label = coachTopics.find(x => x.id === topic)?.label ?? topic;
    setMessages(previous => [...previous,
      { id: previous.length, author: "you", text: label },
      { id: previous.length + 1, author: "coach", text: coachReply(topic) },
    ]);
  }
  const available = new Set(statuses.filter(item => item.enabled && item.text).map(item => item.id));
  // Same behavior as the scanner: the original Gemini choice stays visible when status lookup fails;
  // authenticated backend admission remains authoritative and will reject unavailable providers.
  if (statuses.length === 0) available.add("gemini");
  if (localAvailable) available.add("ollama-local");
  const chosenEnabled = available.has(model);
  const listed = recommendedProviders("coach").map(id => aiModelCatalog.find(item => item.id === id)).filter((item): item is (typeof aiModelCatalog)[number] => Boolean(item));
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (working || !chosenEnabled || message.length < 3 || message.length > 650) return;
    setWorking(true);
    setError(null);
    const history = messages.slice(-6).map(entry => ({role: entry.author === "you" ? "user" as const : "assistant" as const, text: entry.text.slice(0, 500)}));
    try {
      const payload = {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message, model, history})};
      // Local dev has its own signed-in endpoint and in-memory throttle; never call a cloud API.
      const response = model === "ollama-local"
        ? await fetch("/api/coach/local", payload)
        : await submitAiRequest("/api/coach/chat", payload, {modelId:model});
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(typeof data.error === "string" ? data.error : "AI Coach is unavailable.");
      setMessages(previous => [...previous,
        { id: previous.length, author: "you", text: message },
        { id: previous.length + 1, author: "coach", text: data.reply },
      ]);
      setDraft("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not get a response."); }
    finally { setWorking(false); }
  }
  return <main className="min-h-[calc(100vh-76px)] bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your wellness companion</p>
        <h1 className="text-3xl font-bold">AI Coach</h1>
        <p className="max-w-xl text-sm text-slate-600">Ask about meal planning, basic nutrition, exercise and fitness habits. Preset guidance stays free without an AI call.</p>
      </header>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Coach conversation">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-7"><div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 font-bold text-white">AF</div>
          <div><h2 className="font-semibold">AURA Coach</h2><p className="text-xs text-slate-500">Purpose-based AI Â· Explicit provider selection Â· No paid fallback</p></div>
        </div></div>
        <div className="flex min-h-72 flex-col gap-4 p-5 sm:p-7" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map(message => <div key={message.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.author === "you" ? "self-end bg-emerald-600 text-white" : "self-start border border-slate-200 bg-slate-50 text-slate-900"}`}>
            {message.text}</div>)}
        </div>
        <div className="border-t border-slate-200 p-5 sm:p-7"><p className="mb-3 text-sm font-semibold">Free built-in guidance â€” no credits used</p>
          <div className="grid gap-2 sm:grid-cols-2">{coachTopics.map(topic => <button key={topic.id} type="button" onClick={() => choose(topic.id)} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{topic.label}</button>)}</div>
          <form onSubmit={send} className="mt-5 space-y-3 border-t border-slate-200 pt-5">
            <label htmlFor="coach-ai-provider" className="block text-sm font-semibold">Ask an AI provider</label>
            <select id="coach-ai-provider" value={model} onChange={event=>setModel(event.target.value as AiModelId)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm">
              {listed.map(item => <option key={item.id} value={item.id} disabled={!available.has(item.id)}>{item.name}{!available.has(item.id) ? " (unavailable)" : ""}</option>)}
            </select>
            <label htmlFor="coach-message" className="block text-sm font-medium">Your question</label>
            <textarea id="coach-message" value={draft} rows={3} maxLength={650} onChange={e=>setDraft(e.target.value)} placeholder="e.g. Suggest a satisfying dinner with more protein" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
            <button type="submit" disabled={!chosenEnabled || working || draft.trim().length < 3} className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{working ? "Thinking..." : "Ask AURA"}</button>
            <p className="text-xs text-slate-500">Local Ollama uses 0 cloud AI credits and has a separate 30/day development-process limit (resets on server restart). Other AI providers use your 60/day refinement allowance. Avoid sensitive details; no automatic fallback.</p>
            {error && <p role="alert" className="rounded-xl border border-red-200 p-3 text-sm text-red-700">{error}</p>}
          </form>
        </div>
      </section>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        <strong className="text-slate-900">Privacy and limits:</strong> This chat currently uses your typed message only. It does not read saved meals, goals, or health records. Responses are general wellness information, not medical advice. For your own data, visit <Link href="/reports" className="font-semibold underline">Daily Reports</Link> or <Link href="/goals" className="font-semibold underline">Goals</Link>.
      </div>
    </div>
  </main>;
}