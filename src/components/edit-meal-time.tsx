"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { updateMealConsumedAt } from "@/app/meals/update-time";
import {
  localDateString,
  localMealTimeToIso,
} from "@/lib/meal-time-input";

type Props = {
  mealId: string;
  consumedAt: string;
  createdAt: string;
};

function formatLocal(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function EditMealTime({
  mealId,
  consumedAt,
  createdAt,
}: Props) {
  const router = useRouter();
  const savingRef = useRef(false);

  const [eatenLabel, setEatenLabel] =
    useState<string | null>(null);
  const [loggedLabel, setLoggedLabel] =
    useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEatenLabel(formatLocal(consumedAt));
    setLoggedLabel(formatLocal(createdAt));
  }, [consumedAt, createdAt]);

  function openEditor() {
    const eatenDate = new Date(consumedAt);

    setDate(localDateString(eatenDate));
    setTime(
      `${String(eatenDate.getHours()).padStart(2, "0")}:` +
      `${String(eatenDate.getMinutes()).padStart(2, "0")}`
    );

    setError(null);
    setEditing(true);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }

    const iso = localMealTimeToIso(date, time);

    if (!iso) {
      setError(
        "Please choose a valid eating date and time that is not in the future."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      const result = await updateMealConsumedAt(
        mealId,
        iso
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError(
        "Could not update the eating time. Please try again."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-600">
        <span className="font-medium">Eaten at:</span>{" "}
        <time dateTime={consumedAt}>
          {eatenLabel ?? "Loading time..."}
        </time>
      </p>

      <p className="text-xs text-slate-400">
        <span className="font-medium">Logged at:</span>{" "}
        <time dateTime={createdAt}>
          {loggedLabel ?? "Loading time..."}
        </time>
      </p>

      {!editing ? (
        <button
          type="button"
          onClick={openEditor}
          className="text-xs font-semibold text-emerald-700 hover:underline"
        >
          Edit eating time
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="max-w-sm space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm font-semibold text-slate-900">
            Correct eating time
          </p>

          <label className="block text-xs font-medium text-slate-600">
            Date eaten
            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              disabled={saving}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Time eaten
            <input
              type="time"
              value={time}
              onChange={(event) =>
                setTime(event.target.value)
              }
              disabled={saving}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <p className="text-xs text-slate-500">
            Times use your device's local timezone.
          </p>

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save change"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}