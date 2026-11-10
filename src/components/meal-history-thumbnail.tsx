"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = { src?: string | null; foodName: string; emoji: string };

/** Opens an existing PRIVATE, short-lived signed thumbnail URL. Never exposes a public bucket. */
export function MealHistoryThumbnail({ src, foodName, emoji }: Props) {
  const [open, setOpen] = useState(false);
  const thumbnailButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      thumbnailButton.current?.focus();
    };
  }, [open]);

  if (!src) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf6e7] text-xl" role="img" aria-label="Food emoji">
        {emoji}
      </span>
    );
  }

  return (
    <>
      <button
        ref={thumbnailButton}
        type="button"
        aria-label={`Enlarge saved photo: ${foodName}`}
        title="View larger meal photo"
        className="h-11 w-11 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 transition hover:ring-2 hover:ring-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        onClick={(event) => {
          // The thumbnail lives inside the meal's <summary> element. Do not open/close its details.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <img src={src} alt={foodName} loading="lazy" width={44} height={44} className="h-full w-full object-cover" />
      </button>
      {open && createPortal(
        <div
          role="presentation"
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/85 p-4"
          onMouseDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div role="dialog" aria-modal="true" aria-label={`Saved meal photo: ${foodName}`} className="relative max-h-[94dvh] max-w-[96vw] rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-10 min-h-10 cursor-pointer rounded-full bg-slate-950/85 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              aria-label="Close meal photo preview"
            >
              Close
            </button>
            <img src={src} alt={`Saved thumbnail of ${foodName}`} className="max-h-[82dvh] max-w-[88vw] rounded-xl object-contain" />
            <p className="mt-2 max-w-[80vw] truncate text-center text-xs text-slate-600">{foodName}</p>
          </div>
        </div>, document.body,
      )}
    </>
  );
}
