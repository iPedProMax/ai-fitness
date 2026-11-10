"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { performAdminAccountAction, type AccountDetail } from "@/lib/admin-account-actions";
import type { AccountOperation } from "@/lib/admin-account-policy";

const CONFIRM: Record<AccountOperation,string>={reset:"RESET ACCOUNT",delete:"DELETE ACCOUNT"};
const LABELS: Record<AccountOperation,string>={reset:"Reset tracking data",delete:"Delete account permanently"};

export function AdminAccountControls({account}:{account:AccountDetail}){
  const router=useRouter();
  const [operation,setOperation]=useState<AccountOperation|null>(null);
  const [typedEmail,setTypedEmail]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{ok:boolean;message:string}|null>(null);
  function start(action:AccountOperation){setOperation(action);setTypedEmail("");setConfirmation("");setReason("");setResult(null);}
  async function submit(){
    if(!operation||busy)return;
    setBusy(true);setResult(null);
    try{
      const reply=await performAdminAccountAction({targetId:account.id,operation,expectedEmail:account.email,typedEmail,confirmation,reason});
      setResult(reply);
      if(reply.ok){setOperation(null);router.refresh();if(operation==="delete")router.push("/admin/analytics/users");}
    }catch{setResult({ok:false,message:"Request failed. No success was confirmed."});}
    finally{setBusy(false);}
  }
  return <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Account actions">
    <h2 className="text-lg font-bold">Account actions</h2>
    <p className="mt-1 text-sm text-slate-600">Only process a verified user request. These actions cannot be undone.</p>
    {account.protectedAccount&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">Protected account: administrators, allowlisted users and the signed-in administrator cannot be reset or deleted.</p>}
    {!account.actionsEnabled&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">Actions are disabled. Configure the server feature flag, audited database migration and storage preflight. No action can proceed until all checks pass.</p>}
    {account.storageCount!==null && account.storageCount>0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">Stored files or meal thumbnails detected. These must be reviewed and removed separately through the Storage API before reset or deletion.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <button type="button" disabled={!account.actionsEnabled||busy} onClick={()=>start("reset")} className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50">Reset tracking data<p className="mt-1 text-xs font-normal">Clears meals, activity, weight, water, goals, recipes, barcodes and preferences. Retains login and AI usage limits.</p></button>
      <button type="button" disabled={!account.actionsEnabled||busy} onClick={()=>start("delete")} className="cursor-pointer rounded-2xl border border-red-200 bg-red-50 p-4 text-left font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-50">Delete account<p className="mt-1 text-xs font-normal">Deletes authentication and associated records. Irreversible; requires no owned Storage objects.</p></button>
    </div>
    {operation&&<div className="mt-5 space-y-4 rounded-2xl border border-red-200 bg-red-50/30 p-4">
      <div><h3 className="font-bold text-red-900">Confirm: {LABELS[operation]}</h3><p className="mt-1 text-xs text-slate-600">Verify the user's request outside this app. The confirmation is recorded in a restricted audit log.</p></div>
      <label className="block text-sm font-medium">Request reference / reason (12–500 characters)<textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3" rows={2} placeholder="Example: User confirmed deletion by support request #..." /></label>
      <label className="block text-sm font-medium">Type target email: <strong>{account.email}</strong><input value={typedEmail} onChange={e=>setTypedEmail(e.target.value)} autoComplete="off" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3" /></label>
      <label className="block text-sm font-medium">Type exactly: <strong>{CONFIRM[operation]}</strong><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3" /></label>
      <p className="text-xs text-slate-600">Admin must have signed in again within the last ten minutes. No shared admin123 password is used.</p>
      <div className="flex gap-2"><button type="button" disabled={busy||reason.trim().length<12||typedEmail.trim().toLowerCase()!==account.email.toLowerCase()||confirmation!==CONFIRM[operation]} onClick={()=>void submit()} className="cursor-pointer rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?"Verifying...":LABELS[operation]}</button><button type="button" disabled={busy} onClick={()=>setOperation(null)} className="cursor-pointer rounded-xl border px-4 py-3 text-sm disabled:cursor-not-allowed">Cancel</button></div>
    </div>}
    {result&&<p role={result.ok?"status":"alert"} className={`mt-4 rounded-xl p-4 text-sm ${result.ok?"bg-emerald-50 text-emerald-900":"bg-amber-50 text-amber-900"}`}>{result.message}</p>}
  </section>;
}
