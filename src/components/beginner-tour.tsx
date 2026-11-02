"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BEGINNER_TOUR_EVENT,
  beginnerTourSteps,
  beginnerTourStorageKey,
  spotlightCardPosition,
  spotlightHole,
  type SpotlightRect,
  type TourResult,
} from "@/lib/beginner-tour";

type TourMode = "closed" | "intro" | "tour";

type Screen = { width: number; height: number };

/** Optional, client-only onboarding. Does not run any AI request or save server data. */
export function BeginnerTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const checkedAccount = useRef<string | null>(null);
  const [mode, setMode] = useState<TourMode>("closed");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [screen, setScreen] = useState<Screen>({ width: 1024, height: 768 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // The server's Supabase auth context determines which account owns this state.
  // A different login in the same browser must never inherit another user's choice.
  useEffect(() => {
    let active = true;
    try {
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!active || error) return;
        const id = data.user?.id ?? null;
        if (checkedAccount.current === id) return;
        checkedAccount.current = id;
        setUserId(id);
        setStepIndex(0);
        setRect(null);
        if (!id) { setMode("closed"); return; }
        let previouslyViewed = false;
        try { previouslyViewed = localStorage.getItem(beginnerTourStorageKey(id)) !== null; } catch { /* Browser storage disabled. */ }
        setMode(previouslyViewed ? "closed" : "intro");
      }).catch(() => { /* Auth failure: do not show tour without a verified user. */ });
    } catch { /* Supabase not configured: no tutorial on unsigned routes. */ }
    return () => { active = false; };
  }, [pathname]);

  const finish = useCallback((outcome: TourResult) => {
    if (userId) {
      try { localStorage.setItem(beginnerTourStorageKey(userId), outcome); } catch { /* Private mode. */ }
    }
    setRect(null);
    setMode("closed");
  }, [userId]);

  useEffect(() => {
    const replay = () => {
      if (!userId) return;
      setStepIndex(0);
      setRect(null);
      setMode("intro");
    };
    window.addEventListener(BEGINNER_TOUR_EVENT, replay);
    return () => window.removeEventListener(BEGINNER_TOUR_EVENT, replay);
  }, [userId]);

  const next = () => {
    if (stepIndex === beginnerTourSteps.length - 1) finish("completed");
    else { setRect(null); setStepIndex(value => value + 1); }
  };
  const back = () => { setRect(null); setStepIndex(value => Math.max(0, value - 1)); };
  const start = () => { setStepIndex(0); setMode("tour"); };

  useEffect(() => {
    if (mode !== "intro") return;
    const original = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = original; };
  }, [mode]);

  useEffect(() => {
    if (mode === "closed") return;
    const measureScreen = () => setScreen({ width: window.innerWidth, height: window.innerHeight });
    measureScreen();
    window.addEventListener("resize", measureScreen);
    return () => window.removeEventListener("resize", measureScreen);
  }, [mode]);

  useEffect(() => {
    if (mode !== "tour") return;
    const step = beginnerTourSteps[stepIndex];
    if (pathname !== step.path) {
      setRect(null);
      router.push(step.path);
      return;
    }
    let firstTarget = true;
    const measure = () => {
      const element = Array.from(document.querySelectorAll<HTMLElement>(step.selector)).find(candidate => candidate.getClientRects().length > 0 && candidate.getBoundingClientRect().width > 0 && window.getComputedStyle(candidate).visibility !== "hidden");
      if (!element || !element.getClientRects().length) { setRect(null); return; }
      if (firstTarget) {
        firstTarget = false;
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const box = element.getBoundingClientRect();
      const current = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      setRect(previous => previous && Object.keys(current).every(key =>
        Math.abs(previous[key as keyof SpotlightRect] - current[key as keyof SpotlightRect]) < 1
      ) ? previous : current);
    };
    measure();
    const interval = window.setInterval(measure, 250);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [mode, pathname, router, stepIndex]);

  useEffect(() => {
    if (mode === "closed") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish("skipped"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, finish]);

  useEffect(() => {
    if (mode !== "closed") modalRef.current?.focus();
  }, [mode, stepIndex]);

  if (!mounted || mode === "closed" || !userId) return null;

  if (mode === "intro") {
    return createPortal(
      <div data-khalories-tour-overlay="intro" style={{ position: "fixed", inset: 0, zIndex: 1000, maxHeight: "100dvh", overflowY: "auto" }} className="flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-[3px]">
        <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="khalories-tour-welcome" className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-slate-900 shadow-2xl outline-none sm:p-8">
          <div aria-hidden="true" className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">{"\u{1F44B}"}</div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your first steps</p>
          <h2 id="khalories-tour-welcome" className="mt-2 text-2xl font-extrabold">Welcome to Khalories AI!</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Want a quick tour? We'll highlight the real controls for food logging, Coach FONZ, reports, activities, and settings. No analyses or AI credits are used.</p>
          <p className="mt-3 text-xs text-slate-500">About eight short stops. You can skip at any point and replay it from Settings.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={start} className="min-h-11 flex-1 cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Start the tour</button>
            <button type="button" onClick={() => finish("skipped")} className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">Skip for now</button>
          </div>
        </div>
      </div>, document.body,
    );
  }

  const step = beginnerTourSteps[stepIndex];
  const hole = pathname === step.path && rect ? spotlightHole(rect, screen.width, screen.height) : null;
  const card = spotlightCardPosition(hole, screen.width, screen.height);
  const spaceAbove = hole ? Math.max(0, hole.top - 34) : 0;
  const spaceBelow = hole ? Math.max(0, screen.height - hole.bottom - 34) : 0;
  const placeAbove = !!hole && screen.width >= 440 && spaceAbove >= 150 && (spaceBelow < 260 || spaceAbove > spaceBelow);
  const placeBelow = !!hole && screen.width >= 440 && !placeAbove && spaceBelow >= 150;
  const cardDirection = placeAbove ? "down" : placeBelow ? "up" : "none";
  const cardMaxHeight = Math.max(100, Math.min(340, placeAbove ? spaceAbove : placeBelow ? spaceBelow : screen.height - 32));
  const cardTop = placeAbove && hole ? Math.max(16, hole.top - 18 - cardMaxHeight)
    : placeBelow && hole ? hole.bottom + 18
    : Math.max(16, Math.round((screen.height - cardMaxHeight) / 2));
  const dimStyle = { position: "fixed" as const, background: "rgba(3, 7, 18, .70)", zIndex: 1000 };
  const covers = hole ? [
    { left: 0, top: 0, width: screen.width, height: hole.top },
    { left: 0, top: hole.bottom, width: screen.width, height: Math.max(0, screen.height - hole.bottom) },
    { left: 0, top: hole.top, width: hole.left, height: Math.max(0, hole.bottom - hole.top) },
    { left: hole.right, top: hole.top, width: Math.max(0, screen.width - hole.right), height: Math.max(0, hole.bottom - hole.top) },
  ] : [{ left: 0, top: 0, width: screen.width, height: screen.height }];

  return createPortal(
    <div aria-label="Khalories beginner tour" data-khalories-tour-overlay="spotlight" style={{ position: "fixed", inset: 0, zIndex: 1000, isolation: "isolate" }} className="pointer-events-none">
      {covers.map((cover, i) => <div key={i} aria-hidden="true" style={{ ...dimStyle, ...cover, pointerEvents: "auto" }} />)}
      {hole && <div aria-hidden="true" style={{ position: "fixed", zIndex: 1001, left: hole.left, top: hole.top, width: Math.max(0, hole.right - hole.left), height: Math.max(0, hole.bottom - hole.top), border: "3px solid #34d399", borderRadius: 14, boxShadow: "0 0 0 3px rgba(255,255,255,.9), 0 0 30px rgba(52,211,153,.6)", pointerEvents: "none" }} />}
      {hole && cardDirection !== "none" && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "fixed", zIndex: 1002, width: 24, height: 24, left: Math.max(12, Math.min(screen.width - 36, (hole.left + hole.right) / 2 - 12)), top: cardDirection === "down" ? Math.max(0, hole.top - 34) : Math.min(screen.height - 24, hole.bottom + 4), pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" }}><path d={cardDirection === "down" ? "M12 3v18m0 0-7-7m7 7 7-7" : "M12 21V3m0 0-7 7m7-7 7 7"} /></svg>}
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="khalories-tour-step" className="pointer-events-auto fixed z-[1002] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-5 text-slate-900 shadow-2xl outline-none sm:p-6" style={{ position: "fixed", top: cardTop, left: card.left, width: card.width, maxHeight: cardMaxHeight }}>
        
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Step {stepIndex + 1} of {beginnerTourSteps.length}</p>
          <button type="button" aria-label="Skip the tutorial" onClick={() => finish("skipped")} className="min-h-9 cursor-pointer rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600">Skip tour</button>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">{beginnerTourSteps.map((item, i) => <span key={item.id} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-emerald-500" : "bg-slate-200"}`} />)}</div>
        <h2 id="khalories-tour-step" className="mt-4 text-lg font-extrabold">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
        <p className="mt-3 text-xs font-medium text-emerald-700">{step.hint}</p>
        {!hole && <p role="status" className="mt-2 text-xs text-amber-700">Loading the highlighted feature. You can continue even if it is not visible.</p>}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" disabled={stepIndex === 0} onClick={back} className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Back</button>
          <button type="button" onClick={next} className="min-h-11 cursor-pointer rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{stepIndex === beginnerTourSteps.length - 1 ? "Finish tour" : "Next"}</button>
        </div>
      </div>
    </div>, document.body,
  );
}