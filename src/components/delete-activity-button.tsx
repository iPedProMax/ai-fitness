"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteActivity } from "@/app/activities/actions";

export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function remove() {
    if (!window.confirm("Delete this activity? This cannot be undone.")) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteActivity(id);
        if (!result.ok) { setError(result.message); return; }
        router.refresh();
      } catch {
        setError("Could not delete this activity.");
      }
    });
  }
  return (
    <div className="text-right">
      <button type="button" onClick={remove} disabled={pending}
        className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className="mt-1 max-w-44 text-xs text-red-600">{error}</p>}
    </div>
  );
}
