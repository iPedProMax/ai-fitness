"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { foodAnalysisSchema } from "@/lib/food-analysis";
import { AddMealButton } from "@/components/add-meal-button";
import { saveRecipeTemplate } from "@/app/recipes/actions";
import { recipeOneServing } from "@/lib/recipe-utils";
import type { ManualFoodInput } from "@/lib/manual-food";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { FILIPINO_PRESETS, type FilipinoPreset } from "@/lib/filipino-recipe-presets";

const emptyIngredient = (): ManualFoodInput => ({name:"",grams:"",calories:"",protein:"",carbs:"",fat:""});

function InlineRecipeCreator({ onSaved, preset, onPresetLoaded }: { onSaved: () => Promise<void>; preset: FilipinoPreset | null; onPresetLoaded: () => void }) {
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("2");
  const [ingredients, setIngredients] = useState<ManualFoodInput[]>([emptyIngredient()]);
  const [preview, setPreview] = useState<FoodAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!preset) return;
    setTitle(preset.name);
    setServings(String(preset.servings));
    setIngredients(preset.ingredients.map(item => ({ ...item })));
    setPreview(null);
    setMessage("Preset loaded. All nutrition is illustrative; adjust ingredients, weights and cooking oil to match your recipe before saving.");
    onPresetLoaded();
  }, [preset, onPresetLoaded]);
  function update(i: number, key: keyof ManualFoodInput, value: string) {
    setIngredients(current => current.map((item, index) => index === i ? { ...item, [key]: value } : item));
    setPreview(null);
    setMessage("");
  }
  function showPreview() {
    try {
      const result = recipeOneServing({title, servings:Number(servings), ingredients});
      setPreview(result.analysis);
      setMessage("");
    } catch (cause) {
      setPreview(null);
      setMessage(cause instanceof Error ? cause.message : "Check ingredient nutrition and serving count.");
    }
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await saveRecipeTemplate({ title, servings:Number(servings), ingredients });
      if (!result.ok) { setMessage(result.message); return; }
      setMessage("Recipe saved! Open Saved Foods to log it anytime.");
      await onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save recipe.");
    } finally { setSaving(false); }
  }
  const inputClass = "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4" aria-label="Create recipe">
    <div>
      <h4 className="font-bold text-slate-900">Create a recipe</h4>
      <p className="mt-1 text-xs text-slate-600">Enter ingredient nutrition for the whole batch. Khalories calculates one serving; no AI credits.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-700">Recipe name<input className={inputClass} value={title} maxLength={120} onChange={e => {setTitle(e.target.value);setPreview(null);}} placeholder="Chicken adobo" /></label>
      <label className="text-xs font-semibold text-slate-700">Servings per batch<input className={inputClass} value={servings} type="number" min="1" max="100" step="1" onChange={e => {setServings(e.target.value);setPreview(null);}} /></label>
    </div>
    {ingredients.map((item,i) => <fieldset key={i} className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><legend className="text-sm font-semibold">Ingredient {i+1}</legend>{ingredients.length>1&&<button type="button" className="cursor-pointer text-xs text-red-700" onClick={()=>{setIngredients(current=>current.filter((_,n)=>n!==i));setPreview(null);}}>Remove</button>}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(["name","grams","calories","protein","carbs","fat"] as const).map(key => <label key={key} className="text-xs font-semibold capitalize text-slate-600">{key}{key !== "name" ? key === "calories" ? " (kcal)" : " (g)" : ""}<input className={inputClass} value={item[key]} onChange={e=>update(i,key,e.target.value)} type={key==="name"?"text":"number"} min={key==="name"?undefined:"0"} maxLength={key==="name"?120:undefined} step="any" placeholder={key==="name"?"Ingredient name":"0"} /></label>)}</div>
    </fieldset>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" disabled={ingredients.length>=10} onClick={()=>{setIngredients(current=>[...current,emptyIngredient()]);setPreview(null);}}>+ Ingredient</button>
      <button type="button" className="cursor-pointer rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700" onClick={showPreview}>Preview serving</button>
      <button type="button" className="cursor-pointer rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={()=>void save()}>{saving?"Saving...":"Save recipe"}</button>
    </div>
    {preview && <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="mb-2 text-sm font-semibold">One serving: {Math.round(preview.totalCalories)} kcal</p><AddMealButton analysis={preview} /></div>}
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </section>;
}

type Template = { id: string; title: string; kind: string; analysis_snapshot: unknown };


export function SavedFoodPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"presets" | "create" | "saved">("presets");
  const [presetCategory, setPresetCategory] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [presetSearch, setPresetSearch] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<FilipinoPreset | null>(null);
  const onPresetLoaded = useCallback(() => setSelectedPreset(null), []);
  const usePreset = (item: FilipinoPreset) => {
    setView("create");
    setSelectedPreset(item);
  };

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const db = createClient();
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in to view your saved foods.");
        const { data, error: fetchError } = await db.from("meal_templates")
          .select("id,title,kind,analysis_snapshot")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (fetchError) throw new Error("Saved foods could not be loaded. Check the existing meal_templates setup.");
        if (live) setTemplates((data ?? []) as Template[]);
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : "Could not load saved foods.");
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => { live = false; };
  }, [reloadToken]);

  const filtered = templates.filter(item => item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const categories = ["All", "Ulam", "Soup", "Noodles", "Breakfast", "Vegetables"] as const;
  function presetGroup(item: FilipinoPreset): string {
    const id = item.id;
    if (["tapsilog", "longsilog", "arroz-caldo"].includes(id)) return "Breakfast";
    if (["pork-sinigang", "chicken-tinola", "pork-nilaga"].includes(id)) return "Soup";
    if (id.startsWith("pancit")) return "Noodles";
    if (["ginisang-monggo", "pinakbet", "tortang-talong", "laing", "ginataang-kalabasa"].includes(id)) return "Vegetables";
    return "Ulam";
  }
  const matchingPresets = FILIPINO_PRESETS.filter(item =>
    (presetCategory === "All" || presetGroup(item) === presetCategory) &&
    `${item.name} ${item.note}`.toLocaleLowerCase().includes(presetSearch.trim().toLocaleLowerCase())
  );
  const visiblePresets = showAll || presetSearch.trim() ? matchingPresets : matchingPresets.slice(0, 6);
  const tabClass = (active: boolean) => `cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${active ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-emerald-800"}`;
  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Recipes & Favorites</h3>
          <p className="mt-1 text-sm text-slate-500">Find a dish, make it yours, or log a saved meal.</p>
        </div>
        <Link href="/recipes" className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">Manage recipes</Link>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1" role="group" aria-label="Recipes and favorites views">
        <button type="button" aria-pressed={view === "presets"} className={tabClass(view === "presets")} onClick={() => setView("presets")}>Presets</button>
        <button type="button" aria-pressed={view === "create"} className={tabClass(view === "create")} onClick={() => {setSelectedPreset(null);setView("create");}}>Create Recipe</button>
        <button type="button" aria-pressed={view === "saved"} className={tabClass(view === "saved")} onClick={() => setView("saved")}>Saved Foods</button>
      </div>
      {view === "presets" && <div className="space-y-4" aria-label="Filipino recipe presets">
        <div className="flex items-center justify-between gap-3">
          <div><h4 className="font-bold text-slate-900">Filipino favorites</h4><p className="text-xs text-slate-500">20 customizable recipes. Nutrition is estimated.</p></div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">20 dishes</span>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Search dishes
          <input value={presetSearch} onChange={event=>{setPresetSearch(event.target.value);setShowAll(false);}} maxLength={100} placeholder="Try adobo, tinola, pancit…" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter dishes by category">
          {categories.map(category => <button key={category} type="button" aria-pressed={presetCategory === category} onClick={()=>{setPresetCategory(category);setShowAll(false);}} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${presetCategory === category ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"}`}>{category}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visiblePresets.map(item => <article key={item.id} className="flex min-h-32 flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-200 hover:shadow-sm">
            <div><span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{presetGroup(item)}</span><h5 className="mt-1 text-sm font-bold text-slate-900">{item.name}</h5><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.note} · {item.servings} servings</p></div>
            <button type="button" onClick={()=>usePreset(item)} className="w-fit cursor-pointer rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600">Use & customize →</button>
          </article>)}
        </div>
        {matchingPresets.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No matching dish. You can create your own recipe instead.</p>}
        {!showAll && !presetSearch.trim() && matchingPresets.length > 6 && <button type="button" onClick={()=>setShowAll(true)} className="w-full cursor-pointer rounded-xl border border-emerald-200 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Show {matchingPresets.length - 6} more dishes</button>}
        {showAll && matchingPresets.length > 6 && <button type="button" onClick={()=>setShowAll(false)} className="w-full cursor-pointer rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Show fewer</button>}
      </div>}
      {view === "create" && <div className="space-y-3">
        <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Edit ingredients and servings. No AI credits used.</p><button type="button" onClick={()=>setView("presets")} className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline">← Browse presets</button></div>
        <InlineRecipeCreator onSaved={async()=>{setReloadToken(current=>current+1);}} preset={selectedPreset} onPresetLoaded={onPresetLoaded} />
      </div>}
      {view === "saved" && <div className="space-y-4" aria-label="Saved recipes and favorites">
        <div><h4 className="font-bold text-slate-900">Your saved foods</h4><p className="mt-1 text-xs text-slate-500">Re-log your favorite portions without AI credits.</p></div>
        <label className="block text-sm font-semibold text-slate-700">Search saved foods
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name" maxLength={120} className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>
        {loading && <p role="status" className="text-sm text-slate-500">Loading saved foods…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && filtered.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{templates.length ? "No matching saved foods." : "No saved items yet. Use a preset or create your first recipe."}</div>}
        {!loading && !error && <div className="space-y-3">{filtered.map(template => {
          const result = foodAnalysisSchema.safeParse(template.analysis_snapshot);
          return <article key={template.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h4 className="font-semibold text-slate-900">{template.title}</h4><p className="text-xs text-slate-500">{result.success ? `${Math.round(result.data.totalCalories)} kcal per saved portion` : "Saved nutrition unavailable"}</p></div>
              {result.success && <AddMealButton analysis={result.data} />}
            </div>
          </article>;
        })}</div>}
      </div>}
    </section>
  );
}
