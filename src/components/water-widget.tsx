"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWater } from "@/app/water/actions";

export function WaterWidget({ total, available }: { total: number | null; available: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState("250");
  const [message, setMessage] = useState("");
  function add(ml: number) { start(async () => { const r = await addWater(ml); setMessage(r.ok ? `Added ${ml} mL to your water log.` : r.message); if (r.ok) router.refresh(); }); }
  const filled = Math.min(10, Math.floor(Math.max(0, total ?? 0) / 250));
  return <section className="wellness-card wellness-water-card" aria-label="Water tracking">
    <div className="wellness-card-heading"><div><strong>💧 Hydration tracker</strong><small>Water logged today</small></div><span className="wellness-water-drop" aria-hidden="true">💧</span></div>
    <p className="wellness-water-total">{available ? `${((total ?? 0) / 1000).toFixed(2)} L` : "Not set up"}<span>{available ? " logged today" : ""}</span></p>
    <div className="wellness-water-cups" aria-label={`${filled} of 10 illustrated 250 mL cups filled`}>{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < filled ? "filled" : ""} />)}</div>
    <p className="wellness-water-caption">Each blue cup represents 250 mL logged. The 10-cup display is a visual scale, not a recommended daily target.</p>
    {available ? <div className="wellness-water-actions">
      <button type="button" disabled={pending} onClick={() => add(250)}>＋ Add 250 mL</button>
      <button type="button" disabled={pending} onClick={() => add(500)}>＋ 500 mL</button>
      <label className="sr-only" htmlFor="wellness-water-custom">Custom amount in milliliters</label>
      <input id="wellness-water-custom" type="number" min={50} max={2000} value={custom} onChange={e => setCustom(e.target.value)} />
      <button type="button" disabled={pending || !Number.isInteger(Number(custom)) || Number(custom) < 50 || Number(custom) > 2000} onClick={() => add(Number(custom))}>Add custom</button>
    </div> : <p className="mt-3 text-xs">Water tracking is unavailable until the database is configured.</p>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </section>;
}
