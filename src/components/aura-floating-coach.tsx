"use client";
import { SHARED_TEXT_AI_PROVIDERS } from "@/lib/ai/shared-text-roster";
import { useAuraConversation } from "@/lib/aura-conversation";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { submitAiRequest } from "@/lib/ai-submission";
import { aiModelCatalog, type AiModelId, type AiModelStatus } from "@/lib/ai/model-catalog";
import { recommendedProviders } from "@/lib/ai/provider-roles";
import { coachReply, coachTopics } from "@/lib/coach-guidance";

type ChatMessage = { role: "you" | "aura"; text: string };

/** Small, optional coach window. Shares the actual signed-in coach routes and controls. */
export function AuraFloatingCoach() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useAuraConversation<ChatMessage[]>([{ role: "aura", text: "Hey there! 🌿 Want an easy nutrition tip, or have a question about your day?" }]);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<AiModelId>("ollama-local");
  const [statuses, setStatuses] = useState<AiModelStatus[]>([]);
  const [localAvailable, setLocalAvailable] = useState(false);
  const [personalize, setPersonalize] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/ai/models", { cache: "no-store", signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted && Array.isArray(data?.models)) setStatuses(data.models); }).catch(() => {});
    void fetch("/api/coach/local", { cache: "no-store", signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setLocalAvailable(data?.available === true); }).catch(() => {});
    return () => controller.abort();
  }, [open]);
  useEffect(() => { if (open) { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); } }, [messages, open]);
  useEffect(() => { if (!open) return; const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [open]);

  const available = new Set(statuses.filter(item => item.enabled && item.text).map(item => item.id));
  if (localAvailable) available.add("ollama-local");
  const listed = recommendedProviders("coach").map(id => aiModelCatalog.find(item => item.id === id)).filter((item): item is (typeof aiModelCatalog)[number] => Boolean(item));
  const chosenEnabled = available.has(model);

  function chooseFreeTip() {
    const topic = coachTopics[0];
    if (!topic) return;
    setMessages(prev => [...prev, { role: "you", text: topic.label }, { role: "aura", text: coachReply(topic.id) }]);
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = draft.trim();
    if (sending || !chosenEnabled || message.length < 3 || message.length > 650) return;
    setError(""); setSending(true);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role === "you" ? "user" as const : "assistant" as const, text: m.text.slice(0, 500) }));
      const request = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, model, history, useSavedData: personalize }) };
      const response = model === "ollama-local" ? await fetch("/api/coach/local", request) : await submitAiRequest("/api/coach/chat", request, { modelId: model });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(typeof data.error === "string" ? data.error : "AURA is temporarily unavailable.");
      setMessages(prev => [...prev, { role: "you", text: message }, { role: "aura", text: data.reply }]);
      setDraft("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not send your message."); }
    finally { setSending(false); }
  }
  return <div className="wellness-chat-root">
    {open && <section data-fonz-panel="true" aria-label="Quick AURA coach chat" className="wellness-chat-panel" role="dialog" aria-modal="false">
      <div className="wellness-chat-header"><div><p className="text-base font-extrabold">✦ Coach FONZ</p><p className="text-xs opacity-85">Your friendly wellness companion</p></div><button type="button" aria-label="Close AURA chat" onClick={() => setOpen(false)} className="wellness-chat-close">✕</button></div>
      <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text" className="wellness-chat-messages">
        {messages.map((msg, i) => <p data-fonz-speaker={["you", "user"].includes(String(msg.role)) ? "you" : "coach"} key={i} className={`wellness-chat-bubble ${msg.role === "you" ? "wellness-from-user" : "wellness-from-aura"}`}>{msg.text}</p>)}
      </div>
      <div className="wellness-chat-controls">
        <button type="button" onClick={chooseFreeTip} className="wellness-free-tip">✳ Give me a free quick tip</button>
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="mini-aura-provider" className="block text-xs font-bold">AI provider</label>
          <select id="mini-aura-provider" value={model} onChange={e => setModel(e.target.value as AiModelId)} className="w-full p-2 text-sm">
            {listed.filter(entry => SHARED_TEXT_AI_PROVIDERS.some(allowed => allowed === (typeof entry === "string" ? entry : entry.id))).map(item => <option key={item.id} value={item.id} disabled={!available.has(item.id)}>{item.name}{!available.has(item.id) ? " (unavailable)" : ""}</option>)}
          </select>
          <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={personalize} onChange={e => setPersonalize(e.target.checked)} className="mt-1" /> <span>Use my saved food and activity summary for this reply (optional; off by default)</span></label>
          <label htmlFor="mini-aura-message" className="sr-only">Ask Coach FONZ</label>
          <textarea ref={inputRef} id="mini-aura-message" rows={2} maxLength={650} value={draft} onChange={e => setDraft(e.target.value)} placeholder="What should I eat next?" className="w-full resize-none p-3 text-sm" />
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={!chosenEnabled || sending || draft.trim().length < 3} className="wellness-send w-full rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">{sending ? "AURA is thinking…" : chosenEnabled ? "Send message ↗" : "Select an available provider"}</button>
        </form>
        <p className="text-[10px] leading-4 opacity-65">Cloud messages use your existing coach allowance. No paid fallback. Tips are free. Not medical advice.</p>
        <Link href="/coach" onClick={() => setOpen(false)} className="block text-center text-xs font-bold underline underline-offset-4">Open full AI Coach ↗</Link>
      </div>
    </section>}
    <button data-fonz-fab="true" type="button" className="wellness-chat-fab" aria-expanded={open} aria-label={open ? "Close AI Coach" : "Chat with Coach FONZ"} onClick={() => {setOpen(!open); if (!open) window.setTimeout(() => inputRef.current?.focus(), 100);}}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><rect x="4" y="6" width="16" height="14" rx="5"/><path d="M12 3v3 M9 13h.01 M15 13h.01 M9 17c1.6 1 4.4 1 6 0"/></svg>
      {!open && <span className="wellness-chat-spark" aria-hidden="true">✦</span>}
    </button>
  </div>;
}
