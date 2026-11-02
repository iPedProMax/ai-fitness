"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Same-tab AURA conversation continuity. No server uploads, cookies or cloud sync. */
const STORAGE_KEY = "khalories:aura:conversation:v1";
const CHANGE_EVENT = "khalories:aura:conversation-changed";
const MAX_MESSAGES = 50;

type SavedMessage = { who: "you" | "coach"; text: string };
type Envelope = { version: 1; messages: SavedMessage[] };

export function normalizeAuraMessages(value: unknown): SavedMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_MESSAGES).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const message = raw.text ?? raw.content ?? raw.message;
    if (typeof message !== "string" || !message.trim()) return [];
    const who = [raw.author, raw.role, raw.sender].some(x => x === "you" || x === "user") ? "you" : "coach";
    return [{ who, text: message.slice(0, 2000) }];
  });
}

export function adaptAuraMessages<T>(saved: SavedMessage[], initial: T): T {
  if (!Array.isArray(initial)) return initial;
  const reference = initial[0] && typeof initial[0] === "object" ? initial[0] as Record<string, unknown> : {};
  const result = saved.map((item, i) => {
    const author = item.who === "you" ? "you" : "coach";
    const role = item.who === "you" ? "user" : "assistant";
    // Both aliases are intentional: the floating and full coach may have
    // different UI types. No server-only identifiers or snapshots are saved.
    const adapted: Record<string, unknown> = {
      id: typeof reference.id === "string" ? String(i) : i,
      author, role, sender: role,
      text: item.text, content: item.text, message: item.text,
    };
    return adapted;
  });
  return result as T;
}

function read(): Envelope | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data: unknown = JSON.parse(stored);
    if (!data || typeof data !== "object" || (data as Envelope).version !== 1) return null;
    const messages = normalizeAuraMessages((data as Envelope).messages.map(m => ({ author: m.who, text: m.text })));
    return messages.length ? { version: 1, messages } : null;
  } catch { return null; }
}

function write(messages: SavedMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, messages } satisfies Envelope));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* Private mode or storage quota: live chat still works. */ }
}

/** Clears this tab's AURA session when the user leaves for authentication. */
export function clearAuraConversation(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Drop-in useState replacement for chat messages in either AURA surface. */
export function useAuraConversation<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialState);
  const latest = useRef(value);
  const initial = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  useEffect(() => {
    const restore = () => {
      const saved = read();
      if (!saved) return;
      const adapted = adaptAuraMessages(saved.messages, initial.current);
      latest.current = adapted;
      setValue(adapted);
    };
    if (read()) restore();
    else if (normalizeAuraMessages(latest.current).length) write(normalizeAuraMessages(latest.current));
    window.addEventListener(CHANGE_EVENT, restore);
    return () => window.removeEventListener(CHANGE_EVENT, restore);
  }, []);

  const setShared = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next = typeof action === "function"
      ? (action as (previous: T) => T)(latest.current)
      : action;
    latest.current = next;
    setValue(next);
    const messages = normalizeAuraMessages(next);
    if (messages.length) write(messages);
  }, []);
  return [value, setShared];
}
