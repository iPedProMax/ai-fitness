"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {foodAnalysisSchema} from "@/lib/food-analysis";
import {makeManualFoodAnalysis,type ManualFoodInput} from "@/lib/manual-food";
import {updateSavedMealNutrition} from "@/app/meals/edit-nutrition";
export function MealEditor({id,snapshot}:{id:string;snapshot:unknown}){
 const router=useRouter();const[pending,start]=useTransition();const[open,setOpen]=useState(false);const[message,setMessage]=useState("");
 const parsed=foodAnalysisSchema.safeParse(snapshot);
 const [items,setItems]=useState<ManualFoodInput[]>(()=>parsed.success?parsed.data.foods.map(f=>({name:f.name,grams:String(f.estimatedGrams||""),calories:String(f.calories),protein:f.unknownMacros?.includes("protein")?"":String(f.protein),carbs:f.unknownMacros?.includes("carbs")?"":String(f.carbs),fat:f.unknownMacros?.includes("fat")?"":String(f.fat)})):[]);
 if(!parsed.success || !items.length)return null;
 function change(index:number,key:keyof ManualFoodInput,value:string){setItems(old=>old.map((f,i)=>i===index?{...f,[key]:value}:f));}
 function save(){let next;try{next=makeManualFoodAnalysis(items);}catch(e){setMessage(e instanceof Error?e.message:"Invalid nutrition");return;}
   start(async()=>{const result=await updateSavedMealNutrition(id,next);setMessage(result.ok?"Updated meal nutrition.":result.message);if(result.ok){setOpen(false);router.refresh();}});
 }
 return <div className="mt-3"><button type="button" onClick={()=>setOpen(!open)} className="cursor-pointer text-xs font-semibold text-emerald-700 underline">{open?"Close editor":"Edit nutrition"}</button>
  {open&&<div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-600">Manual corrections replace the saved estimate. Empty macros remain unknown. Editing requires the optional transactional Supabase migration.</p>
   {items.map((item,i)=><div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(["name","grams","calories","protein","carbs","fat"] as const).map(key=><label key={key} className="text-xs font-semibold capitalize">{key}<input value={item[key]} onChange={e=>change(i,key,e.target.value)} type={key==="name"?"text":"number"} min={key==="name"?undefined:"0"} step="any" className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label>)}</div>)}
   <button type="button" onClick={save} disabled={pending} className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save corrections</button>
  </div>}{message&&<p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}</div>;
}
