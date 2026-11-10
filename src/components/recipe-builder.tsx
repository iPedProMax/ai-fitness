"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {saveRecipeTemplate,deleteMealTemplate} from "@/app/recipes/actions";
import {recipeOneServing} from "@/lib/recipe-utils";
import {foodAnalysisSchema} from "@/lib/food-analysis";
import {AddMealButton} from "@/components/add-meal-button";
import type {FoodAnalysis} from "@/lib/food-analysis";
import type {ManualFoodInput} from "@/lib/manual-food";
const empty=():ManualFoodInput=>({name:"",grams:"",calories:"",protein:"",carbs:"",fat:""});
export type Template={id:string;title:string;kind:string;analysis_snapshot:unknown};
export function RecipeBuilder({templates,error}:{templates:Template[];error:boolean}){
  const router=useRouter();const[pending,start]=useTransition();const[title,setTitle]=useState("");const[servings,setServings]=useState("2");
  const[items,setItems]=useState<ManualFoodInput[]>([empty()]);const[preview,setPreview]=useState<FoodAnalysis|null>(null);const[message,setMessage]=useState("");
  function update(index:number,key:keyof ManualFoodInput,value:string){setItems(arr=>arr.map((i,n)=>n===index?{...i,[key]:value}:i));setPreview(null);}
  function build(){try{const next=recipeOneServing({title,servings:Number(servings),ingredients:items});setPreview(next.analysis);setMessage("");}catch(e){setMessage(e instanceof Error?e.message:"Check recipe ingredients");}}
  function save(){start(async()=>{const result=await saveRecipeTemplate({title,servings:Number(servings),ingredients:items});setMessage(result.ok?"Recipe saved.":result.message);if(result.ok)router.refresh();});}
  function remove(id:string){if(!window.confirm("Delete this saved recipe or favorite?"))return;start(async()=>{const r=await deleteMealTemplate(id);setMessage(r.ok?"Removed.":r.message);if(r.ok)router.refresh();});}
  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"><h2 className="text-xl font-bold">Build a recipe</h2><p className="text-sm text-slate-600">Enter nutrition for each ingredient in the entire batch. We'll divide it by the servings you specify. No AI credits.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Recipe name<input value={title} onChange={e=>{setTitle(e.target.value);setPreview(null);}} maxLength={120} className="mt-1 block w-full rounded-lg border p-3" placeholder="Chicken adobo"/></label>
        <label className="text-sm font-semibold">Servings per batch<input value={servings} onChange={e=>{setServings(e.target.value);setPreview(null);}} type="number" min="1" max="100" className="mt-1 block w-full rounded-lg border p-3"/></label></div>
      {items.map((item,i)=><div key={i} className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center justify-between"><strong className="text-sm">Ingredient {i+1}</strong>{items.length>1&&<button type="button" onClick={()=>{setItems(arr=>arr.filter((_,n)=>n!==i));setPreview(null);}} className="cursor-pointer text-xs text-red-700">Remove</button>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(["name","grams","calories","protein","carbs","fat"] as const).map(key=><label key={key} className="text-xs font-semibold capitalize">{key}{key!=="name"&&" ("+(key==="calories"?"kcal": "g")+")"}<input value={item[key]} onChange={e=>update(i,key,e.target.value)} placeholder={key==="name"?"Ingredient":"0"} type={key==="name"?"text":"number"} min={key==="name"?undefined:"0"} step="any" className="mt-1 w-full rounded-lg border border-slate-300 p-2"/></label>)}</div></div>)}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={items.length>=10} onClick={()=>{setItems(arr=>[...arr,empty()]);setPreview(null);}} className="cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:opacity-50">+ Ingredient</button>
      <button type="button" onClick={build} className="cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold">Preview a serving</button><button type="button" onClick={save} disabled={pending} className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Save recipe</button></div>
      {preview&&<div className="rounded-xl bg-emerald-50 p-3"><p className="mb-2 font-semibold">One serving: {Math.round(preview.totalCalories)} kcal</p><AddMealButton analysis={preview}/></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">My recipes & favorites</h2>{error&&<p role="alert" className="mt-2 text-sm text-red-700">Saved recipes aren't available. Apply the optional Supabase migration to your verified development database.</p>}
      {!error&&templates.length===0&&<p className="mt-2 text-sm text-slate-500">No saved recipes or favorites yet.</p>}
      <div className="mt-3 space-y-3">{templates.map(t=>{const parsed=recipeSnapshot(t.analysis_snapshot);return <div key={t.id} className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="font-semibold">{t.title}</p><p className="text-xs capitalize text-slate-500">{t.kind} · {parsed?`${Math.round(parsed.totalCalories)} kcal per saved portion`:"Unusable nutrition"}</p></div><button type="button" onClick={()=>remove(t.id)} disabled={pending} className="cursor-pointer text-xs text-red-700 disabled:opacity-50">Delete</button></div>{parsed&&<AddMealButton analysis={parsed}/>}</div>})}</div>
    </section>{message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
  </div>;
}
function recipeSnapshot(input:unknown):FoodAnalysis|null{try{const r=foodAnalysisSchema.safeParse(input);return r.success?r.data:null;}catch{return null;}}
