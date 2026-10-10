"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function CheckEmailModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeModal() {
    dialogRef.current?.close();
    router.replace("/auth/login");
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="check-email-title"
      aria-describedby="check-email-description"
      onClose={() => router.replace("/auth/login")}
      onClick={(event) => {
        if (event.target === dialogRef.current) closeModal();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-emerald-500/20 bg-zinc-900 p-0 text-white shadow-2xl backdrop:bg-black/75"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8">
        <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
        </div>
        <h2 id="check-email-title" className="text-2xl font-bold tracking-tight">
          Check your email!
        </h2>
        <p id="check-email-description" className="text-sm leading-6 text-zinc-300">
          We&apos;ve sent you a verification link. Open your inbox and click the link to activate your AI Fitness account.
        </p>
        <p className="rounded-xl border border-white/10 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-300">
          Can&apos;t find it? Check your Spam or Junk folder too.
        </p>
        <a
          href="https://mail.google.com/mail/u/0/#inbox"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-xl border border-white/15 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          Open Gmail (optional)
        </a>
        <button
          type="button"
          onClick={closeModal}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          Continue to sign in
        </button>
      </div>
    </dialog>
  );
}