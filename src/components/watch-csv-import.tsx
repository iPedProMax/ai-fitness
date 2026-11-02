"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importWatchActivities, type WatchCsvRow } from "@/app/activities/import-watch";
import { parseWatchCsvWorkouts } from "@/lib/watch-csv";

export function WatchCsvImport() {
  const router=useRouter(); const [pending,start]=useTransition();const [rows,setRows]=useState<WatchCsvRow[]>([]);
  const [message,setMessage]=useState("");
  async function selectFile(file?:File) {
    setRows([]);setMessage(""); if(!file)return;
    if(file.size>128*1024){setMessage("CSV must be 128 KiB or smaller.");return;}
    try{setRows(parseWatchCsvWorkouts((await file.text()).replace(/^\uFEFF/,"")));}
    catch(e){setMessage(e instanceof Error?e.message:"Invalid CSV.");}
  }
  function submit(){if(!rows.length||pending)return;start(async()=>{
    try{const response=await importWatchActivities(rows);
      if(response.ok){setMessage(`Imported ${response.imported} workouts; ${response.duplicates} duplicates skipped.`);setRows([]);router.refresh();}
      else setMessage(response.message);
    }catch{setMessage("Import failed. Try again after checking your connection.");}
  });}
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="watch-import-title">
    <h2 id="watch-import-title" className="text-xl font-bold text-slate-900">Import smartwatch workouts</h2>
    <p className="mt-2 text-sm text-slate-600">CSV import only — not automatic Apple Health, Garmin or Health Connect syncing. Import exported workout summaries; nothing is uploaded until you confirm.</p>
    <p className="mt-2 text-xs text-slate-500">Columns: performed_at, duration_minutes, activity_type, calories_burned. Optional: intensity, notes. Dates need a timezone (for example 2026-10-30T07:00:00+08:00).</p>
    <label className="mt-4 block text-sm font-semibold text-slate-700">Choose CSV (max 40 workouts)
      <input type="file" accept=".csv,text/csv" className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900" onChange={event=>void selectFile(event.target.files?.[0])}/>
    </label>
    {rows.length>0&&<div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-bold">{rows.length} validated workouts ready to import</p><p className="text-xs">{rows.slice(0,3).map(row=>`${row.activityType} · ${row.durationMinutes} min`).join(" | ")}{rows.length>3?" …":""}</p></div>}
    <button type="button" disabled={pending||rows.length===0} onClick={submit} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending?"Importing…":"Confirm import"}</button>
    {message&&<p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
    <p className="mt-2 text-xs text-slate-500">Duplicate rows are skipped. Watch-reported calories stay separate from food calories. Manual activity logs remain available.</p>
  </section>;
}
