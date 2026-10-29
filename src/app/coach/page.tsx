"use client";
import Link from "next/link";
import { useState } from "react";
import { coachReply, coachTopics, type CoachTopic } from "@/lib/coach-guidance";

type Message = { id: number; author: "coach" | "you"; text: string };
export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, author: "coach", text: "Welcome! Pick a topic below and I'll help you find a manageable next action. This starter coach uses built-in guidance, not a paid AI model." },
  ]);
  function choose(topic: CoachTopic) {
    const label = coachTopics.find(x => x.id === topic)?.label ?? topic;
    setMessages(previous => [...previous,
      { id: previous.length, author: "you", text: label },
      { id: previous.length + 1, author: "coach", text: coachReply(topic) },
    ]);
  }
  return <main className="min-h-[calc(100vh-76px)] bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your wellness companion</p>
        <h1 className="text-3xl font-bold">AI Coach</h1>
        <p className="max-w-xl text-sm text-slate-600">A quiet place to build healthier habits, one decision at a time.</p>
      </header>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Coach conversation">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-7"><div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 font-bold text-white">AF</div>
          <div><h2 className="font-semibold">AURA Coach</h2><p className="text-xs text-slate-500">Free starter guidance · No API requests</p></div>
        </div></div>
        <div className="flex min-h-72 flex-col gap-4 p-5 sm:p-7" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map(message => <div key={message.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.author === "you" ? "self-end bg-emerald-600 text-white" : "self-start border border-slate-200 bg-slate-50 text-slate-900"}`}>
            {message.text}</div>)}
        </div>
        <div className="border-t border-slate-200 p-5 sm:p-7"><p className="mb-3 text-sm font-semibold">What would you like help with?</p>
          <div className="grid gap-2 sm:grid-cols-2">{coachTopics.map(topic => <button key={topic.id} type="button" onClick={() => choose(topic.id)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{topic.label}</button>)}</div>
        </div>
      </section>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        <strong className="text-slate-900">About this preview:</strong> It does not read your saved meals, goals, or health records, and cannot answer free-form questions yet. It provides general wellness education, not medical advice. For your own data, visit <Link href="/reports" className="font-semibold underline">Daily Reports</Link> or <Link href="/goals" className="font-semibold underline">Goals</Link>.
      </div>
    </div>
  </main>;
}
