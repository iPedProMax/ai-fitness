"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteWeightEntry, saveWeightEntry } from "@/app/goals/actions";
import { manilaDateKey, weightDateValid } from "@/lib/fitness-goals";

export type WeightRecord = { id: string; measured_on: string; weight_kg: number };

export function WeightCheckIn({ entries }: { entries: WeightRecord[] }) {
  const router = useRouter();
  const [date, setDate] = useState(manilaDateKey());
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const chronological = [...entries].reverse();
  const low = chronological.length ? Math.min(...chronological.map(e => Number(e.weight_kg))) - 2 : 0;
  const high = chronological.length ? Math.max(...chronological.map(e => Number(e.weight_kg))) : 1;
  const spread = Math.max(1, high - low);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weightKg = Number(weight);
    if (!weight.trim() || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500 || !weightDateValid(date)) {
      setStatus("Enter a valid weight (20–500 kg) and a past or current date."); return;
    }
    startTransition(async () => {
      try {
        const result = await saveWeightEntry({ measuredOn: date, weightKg });
        setStatus(result.ok ? "Weight recorded!" : result.message);
        if (result.ok) { setWeight(""); router.refresh(); }
      } catch { setStatus("Could not record your weight."); }
    });
  }
  function remove(id: string) {
    if (!window.confirm("Delete this weight entry?")) return;
    startTransition(async () => {
      try {
        const result = await deleteWeightEntry(id);
        setStatus(result.ok ? "Weight entry deleted." : result.message);
        if (result.ok) router.refresh();
      } catch { setStatus("Could not delete the weight entry."); }
    });
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold">Weight progress</h2>
      <p className="mt-2 text-sm text-slate-600">Optional. Record up to one check-in per day. Saving again for the same day updates that entry.</p>
      <form onSubmit={submit} className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div><label htmlFor="weight-date" className="block text-sm font-semibold">Date</label><input id="weight-date" type="date" min="2000-01-01" max={manilaDateKey()} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base" value={date} onChange={e=>setDate(e.target.value)} /></div>
        <div><label htmlFor="check-in-weight" className="block text-sm font-semibold">Weight (kg)</label><input id="check-in-weight" type="number" required min="20" max="500" step="0.1" inputMode="decimal" placeholder="e.g. 75.5" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base" value={weight} onChange={e=>setWeight(e.target.value)} /></div>
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Save check-in</button>
      </form>
      {status && <p role="status" className="mt-3 text-sm text-slate-700">{status}</p>}
      {entries.length > 1 && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4" aria-label="Recent weight trend">
          <p className="mb-4 text-xs font-semibold text-slate-600">Weight trend (oldest to newest)</p>
          <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Weight entries range from ${Math.min(...entries.map(e=>Number(e.weight_kg)))} to ${high} kilograms`}>
            {chronological.map(entry=> <div key={entry.id} title={`${entry.measured_on}: ${entry.weight_kg} kg`} className="min-w-0 flex-1 rounded-t-md bg-emerald-500" style={{ height:`${Math.max(10, (Number(entry.weight_kg)-low)/spread*100)}%` }} />)}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{chronological[0].measured_on}</span><span>{chronological[chronological.length-1].measured_on}</span></div>
          <p className="mt-2 text-xs text-slate-500">The chart shows recorded weights, not predicted progress. Day-to-day changes can reflect hydration.</p>
        </div>
      )}
      <div className="mt-5 space-y-2">
        <p className="text-sm font-bold">Recent check-ins</p>
        {entries.length === 0 && <p className="text-sm text-slate-500">No weigh-ins yet. You can add one whenever you're ready.</p>}
        {entries.map(entry => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm"><span>{entry.measured_on} · <strong>{Number(entry.weight_kg).toFixed(1)} kg</strong></span><button disabled={pending} type="button" onClick={()=>remove(entry.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Delete weight entry for ${entry.measured_on}`}>Delete</button></div>)}
      </div>
      {entries.length >= 60 && <p className="mt-3 text-xs text-slate-500">Showing the 60 most recent weigh-ins.</p>}
    </section>
  );
}
