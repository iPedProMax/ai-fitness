"use client";

import { useEffect, useState } from "react";
import type { AiProviderChoice } from "@/components/ai-provider-picker";
import type { FormEvent, ReactNode } from "react";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { analyzeFoodText } from "@/lib/analyze-food-text";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { isTextAiReady } from "@/lib/ai/text-readiness";
import { makeManualFoodAnalysis, type ManualFoodInput } from "@/lib/manual-food";
import { FoodSmartSearch } from "@/components/food-smart-search";
import { nutritionForGrams, type CatalogFood } from "@/lib/open-food-facts";
import { suggestedServings } from "@/lib/serving-options";
import { foodEmoji } from "@/lib/food-emoji";
import { QuickNutritionCalculator, type QuickNutritionSelection } from "@/components/quick-nutrition-calculator";
import { findQuickFoodById, quickNutrition } from "@/lib/quick-nutrition-calculator";
import { ManualFruitSuggestions } from "@/components/manual-fruit-suggestions";
import { findManualFruitById, manualFruitNutritionForGrams, type ManualFruit } from "@/lib/manual-fruit-catalog";
import { matchAiReportedConfidence } from "@/lib/manual-ai-confidence";
import { findNutritionReferenceWarnings } from "@/lib/nutrition-reference-review";
import { findFoodContextWarnings } from "@/lib/food-context-review";
import {
  canSubmitPortionAnswers, findPortionQuestions, makeClarifiedPortionPrompt,
  type PortionAnswer, type PortionQuestion,
} from "@/lib/portion-clarification";


function emptyItem(): ManualFoodInput {
  return { name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" };
}

function toTextNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Preserve manually entered values when AI supplies missing values. */
export function fillMissingFromAi(
  current: ManualFoodInput[],
  suggested: FoodAnalysis["foods"]
): ManualFoodInput[] {
  const used = new Set<number>();
  const filled = suggested.map((food, index) => {
    const normalizedName = food.name.trim().toLocaleLowerCase();
    const match = current.findIndex((item, i) =>
      !used.has(i) && item.name.trim().toLocaleLowerCase() === normalizedName
    );
    // The first existing row can also correspond to a single-food suggestion.
    const fallback = current.length === 1 && suggested.length === 1 ? 0 : -1;
    const found = match >= 0 ? match : fallback;
    if (found >= 0) used.add(found);
    const original = found >= 0 ? current[found] : emptyItem();
    return {
      name: original.name.trim() || food.name,
      grams: original.grams.trim() || toTextNumber(food.estimatedGrams),
      calories: original.calories.trim() || toTextNumber(food.calories),
      protein: original.protein.trim() || toTextNumber(food.protein),
      carbs: original.carbs.trim() || toTextNumber(food.carbs),
      fat: original.fat.trim() || toTextNumber(food.fat),
      ...(original.fiberG?.trim() ? { fiberG: original.fiberG } : food.advancedNutrients?.fiberG !== undefined ? { fiberG: toTextNumber(food.advancedNutrients.fiberG) } : {}),
      ...(original.sugarG?.trim() ? { sugarG: original.sugarG } : food.advancedNutrients?.sugarG !== undefined ? { sugarG: toTextNumber(food.advancedNutrients.sugarG) } : {}),
      ...(original.saturatedFatG?.trim() ? { saturatedFatG: original.saturatedFatG } : {}),
      ...(original.sodiumMg?.trim() ? { sodiumMg: original.sodiumMg } : food.advancedNutrients?.sodiumMg !== undefined ? { sodiumMg: toTextNumber(food.advancedNutrients.sodiumMg) } : {}),
      ...(original.addedSugarG?.trim() ? { addedSugarG: original.addedSugarG } : food.advancedNutrients?.addedSugarG !== undefined ? { addedSugarG: toTextNumber(food.advancedNutrients.addedSugarG) } : {}),
      ...(original.cholesterolMg?.trim() ? { cholesterolMg: original.cholesterolMg } : food.advancedNutrients?.cholesterolMg !== undefined ? { cholesterolMg: toTextNumber(food.advancedNutrients.cholesterolMg) } : {}),
      ...(original.potassiumMg?.trim() ? { potassiumMg: original.potassiumMg } : food.advancedNutrients?.potassiumMg !== undefined ? { potassiumMg: toTextNumber(food.advancedNutrients.potassiumMg) } : {}),
      ...(original.calciumMg?.trim() ? { calciumMg: original.calciumMg } : food.advancedNutrients?.calciumMg !== undefined ? { calciumMg: toTextNumber(food.advancedNutrients.calciumMg) } : {}),
      ...(original.ironMg?.trim() ? { ironMg: original.ironMg } : food.advancedNutrients?.ironMg !== undefined ? { ironMg: toTextNumber(food.advancedNutrients.ironMg) } : {}),
      ...(original.vitaminDMcg?.trim() ? { vitaminDMcg: original.vitaminDMcg } : food.advancedNutrients?.vitaminDMcg !== undefined ? { vitaminDMcg: toTextNumber(food.advancedNutrients.vitaminDMcg) } : {}),
    };
  });
  // Never silently discard a user's manually entered food or known values.
  const leftover = current.filter((item, i) => !used.has(i) &&
    (item.name.trim() || item.calories.trim() || item.protein.trim() || item.carbs.trim() || item.fat.trim())
  );
  return [...filled, ...leftover];
}

type Props = {
  onResult: (result: FoodAnalysis) => void;
  onReset: () => void;
  providerId?: AiProviderChoice;
  aiProviderPicker?: ReactNode;
};

export function LogFoodPanel({ onResult, onReset, providerId = "gemini", aiProviderPicker }: Props) {
  const [items, setItems] = useState<ManualFoodInput[]>([emptyItem()]);
  const [description, setDescription] = useState("");
  const [tool, setTool] = useState<"find" | "calculator" | "details" | "ai">("find");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [modelConfidences, setModelConfidences] = useState<(number | null)[]>([]);
  const [working, setWorking] = useState(false);
  const [pendingPortions, setPendingPortions] = useState<{ prompt: string; questions: PortionQuestion[] } | null>(null);
  const [portionAnswers, setPortionAnswers] = useState<Record<string, PortionAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [smartFoodNotice, setSmartFoodNotice] = useState("");
  const [providerStatuses, setProviderStatuses] = useState<AiModelStatus[] | null>(null);
  const [localOllamaReady, setLocalOllamaReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/coach/local", { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setLocalOllamaReady(data?.available === true); })
      .catch(() => { if (!controller.signal.aborted) setLocalOllamaReady(false); });
    return () => controller.abort();
  }, []);
  const aiProviderReady = providerId === "ollama-local"
    ? localOllamaReady : isTextAiReady(providerStatuses, providerId);

  // The browser includes the signed-in session. 401, network errors or missing
  // status data fail closed without affecting unlimited ordinary manual entry.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/models", { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!controller.signal.aborted) {
          setProviderStatuses(Array.isArray(data?.models) ? data.models : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setProviderStatuses([]);
      });
    return () => controller.abort();
  }, []);

  function updateItem(index: number, key: keyof ManualFoodInput, value: string) {
    setPendingPortions(null);
    setPortionAnswers({});
    onReset();
    setItems((current) => current.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [key]: value } as ManualFoodInput & { _fruitSourceId?: string; _quickFoodId?: string };
      if (key === "grams" && next._quickFoodId) {
        const reference = findQuickFoodById(next._quickFoodId);
        const enteredGrams = Number(value);
        const recalculated = reference && value.trim() && Number.isFinite(enteredGrams) && enteredGrams > 0 && enteredGrams <= 5000
          ? quickNutrition(reference, enteredGrams, "g") : null;
        next.calories = recalculated ? toTextNumber(recalculated.calories) : "";
        next.protein = recalculated ? toTextNumber(recalculated.protein) : "";
        next.carbs = recalculated ? toTextNumber(recalculated.carbs) : "";
        next.fat = recalculated ? toTextNumber(recalculated.fat) : "";
        next.fiberG = recalculated && recalculated.fiberG !== null ? toTextNumber(recalculated.fiberG) : "";
        next.sugarG = recalculated && recalculated.sugarG !== null ? toTextNumber(recalculated.sugarG) : "";
      } else if (key === "grams" && next._fruitSourceId) {
        const fruit = findManualFruitById(next._fruitSourceId);
        const grams = Number(value);
        const scaled = fruit && value.trim() && Number.isFinite(grams) && grams > 0 && grams <= 5000
          ? manualFruitNutritionForGrams(fruit, grams) : null;
        next.calories = scaled ? toTextNumber(scaled.calories) : "";
        next.protein = scaled ? toTextNumber(scaled.protein) : "";
        next.carbs = scaled ? toTextNumber(scaled.carbs) : "";
        next.fat = scaled ? toTextNumber(scaled.fat) : "";
        next.fiberG = scaled && scaled.fiberG !== null ? toTextNumber(scaled.fiberG) : "";
        next.sugarG = scaled && scaled.sugarG !== null ? toTextNumber(scaled.sugarG) : "";
      } else if (key !== "grams") {
        // The user changed the reference value; future weight changes must not overwrite it.
        delete next._fruitSourceId;
        delete next._quickFoodId;
      }
      return next;
    }));
    // A changed value is no longer the original AI estimate.
    setModelConfidences((current) => current.map((score, i) => i === index ? null : score));
    setError(null);
  }

  function chooseManualFruit(index: number, fruit: ManualFruit) {
    const oldWeight = Number(items[index]?.grams);
    const grams = items[index]?.grams.trim() && Number.isFinite(oldWeight) && oldWeight > 0 && oldWeight <= 5000
      ? oldWeight : 100;
    const nutrition = manualFruitNutritionForGrams(fruit, grams);
    const replacement: ManualFoodInput & { _fruitSourceId?: string } = {
      ...emptyItem(),
      _fruitSourceId: fruit.id,
      name: fruit.name,
      grams: toTextNumber(grams),
      calories: toTextNumber(nutrition.calories),
      protein: toTextNumber(nutrition.protein),
      carbs: toTextNumber(nutrition.carbs),
      fat: toTextNumber(nutrition.fat),
      ...(nutrition.fiberG !== null ? { fiberG: toTextNumber(nutrition.fiberG) } : {}),
      ...(nutrition.sugarG !== null ? { sugarG: toTextNumber(nutrition.sugarG) } : {}),
    };
    // Only replace the row explicitly chosen by the user; leave every other food untouched.
    onReset();
    setPendingPortions(null);
    setPortionAnswers({});
    setError(null);
    setItems(current => current.map((row, i) => i === index ? replacement : row));
    setModelConfidences(current => current.map((score, i) => i === index ? null : score));
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      onResult(makeManualFoodAnalysis(items, { aiAssisted, aiConfidences: modelConfidences }));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Invalid food details.");
    }
  }

  function handleAi() {
    if (!aiProviderReady) {
      setError("The selected Text AI is unavailable. You can still enter and log nutrition manually.");
      return;
    }
    if (working) return;
    const prompt = description.trim() || items.map((item) =>
      [item.name.trim(), item.grams.trim() ? `${item.grams.trim()} g` : ""].filter(Boolean).join(", ")
    ).filter(Boolean).join("; ");
    if (prompt.length < 3) {
      setError("Describe the food or enter a food name before asking AI.");
      return;
    }
    const questions = findPortionQuestions(prompt);
    if (questions.length > 0) {
      setPendingPortions({ prompt, questions });
      setPortionAnswers({});
      setError(null);
      return; // No AI API request, no credit spent on the clarifying question.
    }
    setPendingPortions(null);
    void runAiEstimate(prompt);
  }

  function handleConfirmedPortions() {
    if (!pendingPortions || working) return;
    try {
      const clarifiedPrompt = makeClarifiedPortionPrompt(pendingPortions.prompt, pendingPortions.questions, portionAnswers);
      setPendingPortions(null);
      setError(null);
      void runAiEstimate(clarifiedPrompt); // Exactly one estimate request after local clarification.
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Please clarify the portions.");
    }
  }

  async function runAiEstimate(prompt: string) {
    // Recheck at the final dispatch point (after local portion questions).
    if (!aiProviderReady) {
      setError("The selected Text AI is unavailable. No AI request was sent.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const estimate = await analyzeFoodText(prompt, { modelId: providerId });
      if (estimate.foods.length === 0) {
        throw new Error("AI did not return a food estimate.");
      }
      const next = fillMissingFromAi(items, estimate.foods);
      if (next.length > 10) throw new Error("Too many foods. Please split this meal.");
      onReset();
      setItems(next);
      setModelConfidences(matchAiReportedConfidence(next, estimate.foods));
      setAiAssisted(true);
      setTool("details");
    } catch (issue) {

      setError(issue instanceof Error ? issue.message : "AI estimation failed.");
    } finally {
      setWorking(false);
    }
  }

  const numberOrZero = (text: string) => {
    const value = Number(text);
    return text.trim() && Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const knownCalories = items.reduce((sum, food) => sum + numberOrZero(food.calories), 0);
  const knownProtein = items.reduce((sum, food) => sum + numberOrZero(food.protein), 0);
  const knownCarbs = items.reduce((sum, food) => sum + numberOrZero(food.carbs), 0);
  const knownFat = items.reduce((sum, food) => sum + numberOrZero(food.fat), 0);
  // Phase U10A: non-blocking reference nutrition review. No corrections are applied.
  const referenceWarnings = aiAssisted ? findNutritionReferenceWarnings(items) : [];
  // Phase U10B: context review is advisory only; do not alter entered nutrition.
  const contextWarnings = aiAssisted ? findFoodContextWarnings(items, description) : [];
  // Preview the exact text context to be sent before reserving an AI credit.
  let portionPreview = "";
  let portionPreviewError: string | null = null;
  if (pendingPortions && canSubmitPortionAnswers(pendingPortions.questions, portionAnswers)) {
    try {
      portionPreview = makeClarifiedPortionPrompt(pendingPortions.prompt, pendingPortions.questions, portionAnswers);
    } catch (issue) {
      portionPreviewError = issue instanceof Error ? issue.message : "Portion prompt is invalid.";
    }
  }
  const calorieEntriesMissing = items.some(food => !food.calories.trim());
  const ambiguousPortions = /\b(dab|little|some|handful|spoonful|splash|pinch|few|small amount)\b/i.test(description);
  function selectSmartFood(food: CatalogFood, source: string) {
    // A user may have typed "Nissin" into the first row already. Replace that
    // *unfinished* row instead of appending a duplicate food; never overwrite entered nutrients.
    const first = items[0];
    const unfinished = items.length === 1 && ["calories", "protein", "carbs", "fat", "fiberG", "sugarG", "sodiumMg", "addedSugarG", "cholesterolMg", "potassiumMg", "calciumMg", "ironMg", "vitaminDMcg"].every(key =>
      !String(first[key as keyof ManualFoodInput] ?? "").trim()
    );
    if (!unfinished && items.length >= 10) {
      setError("Your meal already contains 10 foods. Remove one before selecting another product.");
      return;
    }
    const preferred = suggestedServings(food)[0]?.grams ?? 100;
    const normalAmount = Number.isFinite(preferred) && preferred > 0 && preferred <= 2000 ? preferred : 100;
    const typedWeight = Number(first?.grams ?? "");
    const amount = unfinished && first.grams.trim() && typedWeight > 0 && typedWeight <= 2000 ? typedWeight : normalAmount;
    const suggested: ManualFoodInput = nutritionForGrams(food, amount);
    setItems(current => unfinished ? [suggested] : [...current, suggested]);
    setModelConfidences(current => unfinished ? [null] : [...current, null]);
    setPendingPortions(null);
    setPortionAnswers({});
    setError(null);
    onReset();
    const known = [suggested.calories, suggested.protein, suggested.carbs, suggested.fat].filter(v => v.trim().length > 0).length;
    setSmartFoodNotice(`${food.name} added from ${source}. ${known}/4 main nutrition fields available; missing nutrients remain blank. Review the serving weight and package label before logging. No AI credits used.`);
    setTool("details");
  }

  function selectQuickNutrition(selection: QuickNutritionSelection): boolean {
    const first = items[0];
    const unfinished = items.length === 1 && ["calories", "protein", "carbs", "fat", "fiberG", "sugarG", "sodiumMg", "addedSugarG", "cholesterolMg", "potassiumMg", "calciumMg", "ironMg", "vitaminDMcg"].every(key =>
      !String(first[key as keyof ManualFoodInput] ?? "").trim()
    );
    if (!unfinished && items.length >= 10) {
      setError("Your meal already has 10 foods. Remove one before adding another reference food.");
      return false;
    }
    const entry: ManualFoodInput & { _quickFoodId?: string } = {
      ...emptyItem(),
      _quickFoodId: selection.food.id,
      name: selection.food.name,
      grams: toTextNumber(selection.grams),
      calories: toTextNumber(selection.calories),
      protein: toTextNumber(selection.protein),
      carbs: toTextNumber(selection.carbs),
      fat: toTextNumber(selection.fat),
      ...(selection.fiberG !== null ? { fiberG: toTextNumber(selection.fiberG) } : {}),
      ...(selection.sugarG !== null ? { sugarG: toTextNumber(selection.sugarG) } : {}),
    };
    setItems(current => unfinished ? [entry] : [...current, entry]);
    setModelConfidences(current => unfinished ? [null] : [...current, null]);
    setPendingPortions(null);
    setPortionAnswers({});
    setError(null);
    onReset();
    setSmartFoodNotice("0 AI credits. " + selection.food.name + " added from a per-100 g nutrition reference. Edit grams to recalculate, or edit nutrients to override the reference. Check the food preparation before logging.");
    setTool("details");
    return true;
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-extrabold text-[#073d2b]">Manual food entry</h3>
      <p className="mt-1 text-sm text-slate-600">Choose a tool below. Your food entries stay saved while you switch.</p>
      <div className="k-manual-tools-tabs mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-[#e3ebdf] bg-[#eef3e9] p-1 sm:grid-cols-4" role="group" aria-label="Manual logging tools">
        {([ ["find", "Find Food"], ["calculator", "Calculator"], ["details", "Enter Details"], ["ai", "AI Estimate"] ] as const).map(([id,label]) => (
          <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)}
            className={"min-h-11 cursor-pointer rounded-xl px-3 py-2.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm " + (tool === id ? "bg-[#076044] text-white shadow-sm" : "text-[#476355] hover:bg-white/75 hover:text-[#073d2b]")}>
            {label}
          </button>
        ))}
      </div>
      {tool === "details" && smartFoodNotice && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">{smartFoodNotice}</p>}
      {tool === "find" && <p className="mt-4 text-xs text-slate-600">Find packaged products and available nutrition references for free. Selecting a result opens Enter Details.</p>}
      {tool === "find" && (
      <div className="mt-4 space-y-2">
        <FoodSmartSearch mode="manual" onSelect={selectSmartFood} />
        {smartFoodNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">{smartFoodNotice}</p>}
      </div>
      )}
      {tool === "calculator" && <QuickNutritionCalculator onUse={selectQuickNutrition} />}
      {tool === "ai" && (
        <div className="mt-4 space-y-3" aria-label="Optional Text AI estimation">
          {aiProviderPicker}
      <div className="mt-5 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <label className="block text-sm font-semibold text-slate-700">
          Describe your meal (optional)
          <textarea rows={3} maxLength={600} value={description}
            onChange={(event) => { onReset(); setDescription(event.target.value); setPendingPortions(null); setPortionAnswers({}); setModelConfidences(current => current.map(() => null)); }}
            placeholder="e.g. 200 g grilled bangus with one cup of rice"
            className={inputClass} />
        </label>
        <button type="button" onClick={handleAi} disabled={working || !aiProviderReady}
          className="w-full rounded-xl border border-emerald-400 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60">
          {working ? "Estimating..." : "✨ Estimate nutrition with AI"}
        </button>
        <p className="text-xs text-slate-500">AI only runs when you press the button. Your existing typed values won't be overwritten.</p>
        {!aiProviderReady && (
          <p role="status" className="text-xs font-medium text-amber-800">
            Text AI is currently unavailable. You can still add foods and review your manual nutrition entries without AI.
          </p>
        )}
        {pendingPortions && (
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Clarify food portions">
            <div>
              <p className="text-sm font-bold text-amber-900">Quick portion check - no extra AI credit</p>
              <p className="mt-1 text-xs text-amber-900">These are example portions, not verified food weights. If you choose each cracker/item, also enter how many items you ate.</p>
            </div>
            {pendingPortions.questions.map(question => (
              <div key={question.id} className="space-y-2 rounded-xl border border-amber-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">What did you mean by &quot;{question.phrase}&quot;?</p>
                {question.examples.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {question.examples.map(example => (
                      <button key={example} type="button"
                        aria-pressed={portionAnswers[question.id]?.amount === example}
                        onClick={() => setPortionAnswers(current => ({ ...current, [question.id]: { ...current[question.id], amount: example } }))}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium ${portionAnswers[question.id]?.amount === example ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700"}`}>
                        {example}
                      </button>
                    ))}
                  </div>
                )}
                <label className="block text-xs font-medium text-slate-700">
                  Or enter your own measured amount (e.g. 5 g, 1 tsp, 1/2 tbsp)
                  <input value={portionAnswers[question.id]?.amount === "UNKNOWN" ? "" : portionAnswers[question.id]?.amount ?? ""}
                    onChange={event => setPortionAnswers(current => ({ ...current, [question.id]: { ...current[question.id], amount: event.target.value } }))}
                    maxLength={90} placeholder="e.g. 5 g, or 1 tsp" className={inputClass} />
                </label>
                {portionAnswers[question.id]?.amount !== "UNKNOWN" && (
                  <>
                    <label className="block text-xs font-semibold text-slate-700">This quantity applies to:
                      <select value={portionAnswers[question.id]?.scope ?? ""}
                        onChange={event => setPortionAnswers(current => ({ ...current, [question.id]: { ...current[question.id], amount: current[question.id]?.amount ?? "", scope: event.target.value as "total" | "each", eachCount: event.target.value === "each" ? current[question.id]?.eachCount : undefined } }))}
                        className={`${inputClass} cursor-pointer`}>
                        <option value="">Select one - no assumptions</option>
                        <option value="total">The whole meal (total amount)</option>
                        <option value="each">Each cracker / portion / described item</option>
                      </select>
                    </label>
                    {portionAnswers[question.id]?.scope === "each" && (
                      <label className="block text-xs font-semibold text-slate-700">
                        How many crackers / items received this amount? (1â€“100)
                        <input type="number" min="1" max="100" step="1" inputMode="numeric"
                          value={portionAnswers[question.id]?.eachCount ?? ""}
                          onChange={event => setPortionAnswers(current => ({ ...current, [question.id]: { ...current[question.id], amount: current[question.id]?.amount ?? "", scope: "each", eachCount: event.target.value } }))}
                          placeholder="e.g. 4 crackers" className={inputClass} />
                      </label>
                    )}
                  </>
                )}
                <button type="button" className="cursor-pointer text-xs font-semibold text-slate-600 underline"
                  onClick={() => setPortionAnswers(current => ({ ...current, [question.id]: { amount: "UNKNOWN" } }))}>
                  I am not sure - keep the uncertainty
                </button>
                {portionAnswers[question.id]?.amount === "UNKNOWN" && <p className="text-xs text-amber-800">Amount marked unknown. AI will be asked to state any assumptions.</p>}
              </div>
            ))}
            {portionPreviewError && <p role="alert" className="text-xs font-medium text-red-700">{portionPreviewError}</p>}
            {portionPreview && (
              <details className="rounded-lg border border-amber-200 bg-white p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700">Preview the exact description sent to AI</summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-slate-700">{portionPreview}</p>
                <p className="mt-2 text-amber-800">An AI estimate still requires an analysis credit. Teaspoon/mL values describe volume, not food weight.</p>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={working || !portionPreview || !aiProviderReady}
                onClick={handleConfirmedPortions} className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Continue to AI estimate (one analysis)
              </button>
              <button type="button" onClick={() => { setPendingPortions(null); setPortionAnswers({}); }}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">Cancel</button>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
      {tool === "details" && (
      <form onSubmit={handleReview} className="mt-5 min-w-0 space-y-4">
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.64fr)] 2xl:items-start">
          <div className="min-w-0 space-y-4">
        {items.map((item, index) => (
          <fieldset key={index} className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
            <legend className="px-1 text-sm font-semibold">Food {index + 1}</legend>
            {modelConfidences[index] != null && (
              <p className="mb-3 text-xs text-violet-700">
                AI-reported confidence: {Math.round(modelConfidences[index] * 100)}% (not calibrated)
              </p>
            )}
            <div className="mb-3 flex items-center gap-3">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-2xl">{foodEmoji(item.name)}</span>
              <span className="text-xs text-slate-500">Automatic food emoji; no image needed</span>
            </div>
            <label className="block text-xs font-medium text-slate-600">Food name (required)
              <input required maxLength={120} value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="e.g. Grilled bangus" className={inputClass} />
            </label>
             <ManualFruitSuggestions
               query={item.name}
               selectedId={(item as ManualFoodInput & { _fruitSourceId?: string })._fruitSourceId}
               onChoose={(fruit) => chooseManualFruit(index, fruit)}
             />
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ["grams", "Serving weight (g, optional)"],
                ["calories", "Calories (kcal)"],
                ["protein", "Protein (g, optional)"],
                ["carbs", "Carbs (g, optional)"],
                ["fat", "Fat (g, optional)"],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-medium text-slate-600">{label}
                  <input type="number" min="0" step="any" value={item[key]}
                    onChange={(event) => updateItem(index, key, event.target.value)}
                    placeholder={key === "calories" ? "Required unless all macros entered" : "Optional"}
                    className={inputClass} />
                </label>
              ))}
            </div>
            <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Optional advanced nutrients (from a label or known values)</summary>
              <p className="mt-2 text-xs text-slate-500">Enter only values you know for this portion. Blank means Unknown; AI Estimate may suggest unverified nutrient amounts. User-entered values take priority. Added sugar is included in total sugar.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {([
                  ["fiberG", "Fiber (g)"], ["sugarG", "Sugar (g)"],
                  ["sodiumMg", "Sodium (mg)"],
                  ["cholesterolMg", "Cholesterol (mg)"],
                  ["potassiumMg", "Potassium (mg)"],
                  ["calciumMg", "Calcium (mg)"],
                  ["ironMg", "Iron (mg)"],
                  ["vitaminDMcg", "Vitamin D (mcg)"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-xs font-medium text-slate-600">{label}
                    <input type="number" min="0" max={key.endsWith("Mg") ? 100000 : 1000} step="any"
                      value={item[key] ?? ""} onChange={event => updateItem(index, key, event.target.value)}
                      placeholder="Unknown" className={inputClass} />
                  </label>
                ))}
              </div>
            </details>
            {items.length > 1 && <button type="button" className="mt-3 text-xs font-semibold text-red-600 hover:underline" onClick={() => { onReset(); setItems((current) => current.filter((_, i) => i !== index)); setModelConfidences(current => current.filter((_, i) => i !== index)); }}>Remove item</button>}
          </fieldset>
        ))}
        {items.length < 10 && (
          <button type="button" onClick={() => { onReset(); setItems((current) => [...current, emptyItem()]); setModelConfidences(current => [...current, null]); }} className="text-sm font-semibold text-emerald-700 hover:underline">+ Add another food</button>
        )}
          </div>
          <aside aria-label="Live nutrition summary" className="min-w-0 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5 2xl:sticky 2xl:top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Live nutrition summary</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{Math.round(knownCalories)} <span className="text-sm font-medium text-slate-600">kcal entered</span></p>
            <p className="mt-1 text-xs text-slate-500">Only includes calories entered above; no missing values are treated as confirmed zero.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownProtein.toFixed(1)}g</span>Protein*</div>
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownCarbs.toFixed(1)}g</span>Carbs*</div>
              <div className="rounded-xl bg-white p-2"><span className="block font-bold text-slate-900">{knownFat.toFixed(1)}g</span>Fat*</div>
            </div>
            <p className="mt-2 text-xs text-slate-500">*Totals of provided values only; blank macros remain unknown.</p>
            {contextWarnings.length > 0 && (
              <details className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                <summary className="cursor-pointer font-semibold">Portion and preparation checks ({contextWarnings.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {contextWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                </ul>
                <p className="mt-2">Confirm your serving details and review the estimate before saving. Nothing is changed automatically.</p>
              </details>
            )}
            {referenceWarnings.length > 0 && (
              <div role="status" aria-label="Nutrition reference review" className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950">
                <p className="font-bold">Check these AI estimates before saving</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {referenceWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                </ul>
                <p className="mt-2">References describe typical foods; recipes and water content vary. Nothing is changed automatically.</p>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {modelConfidences.some(value => value !== null) ? (
                <>
                  <p className="font-bold">Mean AI-reported confidence: {Math.round(modelConfidences.filter((value): value is number => value !== null).reduce((sum, value) => sum + value, 0) / modelConfidences.filter(value => value !== null).length * 100)}%</p>
                  <p className="mt-1">Average of available model self-reported scores, NOT a verified probability of correct calories. Editing a food removes its score.</p>
                </>
              ) : (
                <>
                  <p className="font-bold">Confidence: Unverified</p>
                  <p className="mt-1">No calibrated confidence percentage is available for these manually entered or edited values.</p>
                </>
              )}
              {ambiguousPortions && <p className="mt-2 font-medium">Your description uses a vague portion (such as a dab or spoonful). Use the portion check before AI estimation, or enter a measured quantity for better accuracy.</p>}
              {calorieEntriesMissing && <p className="mt-2">Some foods have no entered calories, so this total is incomplete.</p>}
            </div>
          </aside>
        </div>
        <button type="submit" disabled={working} className="block w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">Review &amp; Add Meal</button>
        <p className="text-xs leading-5 text-slate-500">Food name and calories are needed to save (or enter all three macros to estimate calories). Blank macros stay Unknown, not 0 g.</p>
        {aiAssisted && <p className="text-xs text-emerald-700">AI suggested nutrition values; review and correct them before saving.</p>}
      </form>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
