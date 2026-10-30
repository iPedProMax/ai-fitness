"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {addWater} from "@/app/water/actions";
export function WaterWidget({total,available}:{total:number|null;available:boolean}) {
  const router=useRouter();const[pending,start]=useTransition();const[custom,setCustom]=useState("250");const[message,setMessage]=useState("");
  function add(ml:number){start(async()=>{const r=await addWater(ml);setMessage(r.ok?`Added ${ml} mL.`:r.message);if(r.ok)router.refresh();});}
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Water tracking">
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Water logged today</h2><p className="text-xl font-extrabold">{available?`${(total??0).toLocaleString()} mL`:"Not set up"}</p></div>
    <p className="mt-1 text-xs text-slate-500">Optional drinks log, not a hydration diagnosis. No universal target assumed.</p>
    {available?<div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>add(250)} disabled={pending} type="button" className="cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:opacity-50">+ 250 mL</button><button onClick={()=>add(500)} disabled={pending} type="button" className="cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:opacity-50">+ 500 mL</button><label className="sr-only" htmlFor="custom-water-ml">Custom water milliliters</label><input id="custom-water-ml" value={custom} onChange={e=>setCustom(e.target.value)} type="number" min="50" max="2000" className="w-24 rounded-lg border p-2 text-sm"/><button onClick={()=>add(Number(custom))} disabled={pending} type="button" className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add</button></div>:<p className="mt-2 text-xs text-slate-500">An optional Supabase migration is needed to save water logs across devices.</p>}
    {message&&<p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
  </section>
}
