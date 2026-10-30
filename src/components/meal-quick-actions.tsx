"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {logMealAgain,deleteSavedMeal,saveFavoriteMeal} from "@/app/meals/shortcuts";
export function MealQuickActions({mealId}:{mealId:string}){
  const router=useRouter();const[pending,start]=useTransition();const[message,setMessage]=useState("");
  function run(kind:"again"|"favorite"|"delete"){
    if(kind==="delete"&&!window.confirm("Delete this meal permanently?"))return;
    start(async()=>{
      try {
        const result=kind==="again"?await logMealAgain(mealId):kind==="favorite"?await saveFavoriteMeal(mealId):await deleteSavedMeal(mealId);
        setMessage(result.ok ? kind==="again"?"Meal logged again for now.":kind==="favorite"?"Added to favorites.":"Meal deleted.":result.message);
        if(result.ok)router.refresh();
      } catch { setMessage("Could not update the meal. Try again."); }
    });
  }
  return <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex flex-wrap gap-2">
    <button type="button" disabled={pending} onClick={()=>run("again")} className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Log again</button>
    <button type="button" disabled={pending} onClick={()=>run("favorite")} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Save favorite</button>
    <button type="button" disabled={pending} onClick={()=>run("delete")} className="cursor-pointer rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Delete</button>
  </div>{message&&<p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}</div>;
}
