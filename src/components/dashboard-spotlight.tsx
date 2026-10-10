"use client";

import type { PointerEvent, ReactNode } from "react";

/** A purely decorative mouse-following spotlight for the dashboard hero. */
export function DashboardSpotlight({ children }: { children: ReactNode }) {
  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    // Touchscreens keep the existing static gradient; no touch tracking.
    if (event.pointerType === "touch") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    // Set CSS variables directly to avoid rerendering the whole dashboard
    // on every mouse movement.
    event.currentTarget.style.setProperty(
      "--spotlight-x",
      `${event.clientX - bounds.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--spotlight-y",
      `${event.clientY - bounds.top}px`,
    );
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      className="group relative isolate overflow-hidden rounded-3xl bg-slate-900 px-6 py-8 text-white sm:px-10 sm:py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        style={{
          background:
            "radial-gradient(460px circle at var(--spotlight-x, 75%) var(--spotlight-y, 30%), rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.12) 38%, transparent 78%)",
        }}
      />
      {children}
    </section>
  );
}
