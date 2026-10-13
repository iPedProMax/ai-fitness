"use client";

import { useState, useTransition } from "react";
import { saveFitnessGoal } from "@/app/goals/actions";
import { GOAL_LABELS, type FitnessGoal } from "@/lib/fitness-goals";
import {
  calculateTdee,
  TDEE_ACTIVITY_LEVELS,
  type TdeeActivityLevel,
  type TdeeEstimate,
  type TdeeSex,
} from "@/lib/tdee";
import { centimetersToFeetInches, feetInchesToCentimeters } from "@/lib/height-units";

type SavedGoal = {
  goal_type: FitnessGoal;
  calorie_target: number;
  protein_target: number;
  target_weight_kg: number | null;
};

type TargetOrigin = "none" | "saved" | "recommended" | "custom";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function FitnessGoalForm({ initialGoal }: { initialGoal: SavedGoal | null }) {
  const [goalType, setGoalType] = useState<FitnessGoal>(initialGoal?.goal_type ?? "maintain");
  const [calories, setCalories] = useState(String(initialGoal?.calorie_target ?? ""));
  const [protein, setProtein] = useState(String(initialGoal?.protein_target ?? ""));
  const [targetWeight, setTargetWeight] = useState(String(initialGoal?.target_weight_kg ?? ""));
  const [targetOrigin, setTargetOrigin] = useState<TargetOrigin>(initialGoal ? "saved" : "none");

  // The calculator's personal inputs are not stored by this form.
  const [age, setAge] = useState("");
  // Height stays in centimetres internally, regardless of the user's preferred input.
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<"feet" | "cm">("feet");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState<TdeeSex | "">("");
  const [activityLevel, setActivityLevel] = useState<TdeeActivityLevel | "">("");
  const [estimate, setEstimate] = useState<TdeeEstimate | null>(null);
  const [calculatorMessage, setCalculatorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function calculatorInputChanged() {
    setEstimate(null);
    setCalculatorMessage("");
    setSaved(false);
    // A previously calculated goal is no longer valid if its inputs have changed.
    // Do not silently save calorie/protein values for outdated measurements.
    if (targetOrigin === "recommended") {
      setCalories("");
      setProtein("");
      setTargetOrigin("none");
      setMessage("Your details changed. Calculate again for updated goals.");
    }
  }

  function heightUnitChanged(unit: "feet" | "cm") {
    if (unit === heightUnit) return;
    if (unit === "feet" && height.trim()) {
      const cm = Number(height);
      if (Number.isFinite(cm) && cm > 0) {
        const converted = centimetersToFeetInches(cm);
        setFeet(String(converted.feet));
        setInches(String(converted.inches));
      }
    }
    setHeightUnit(unit);
    // Changing the display unit alone doesn't change the actual height or goals.
  }

  function feetOrInchesChanged(nextFeet: string, nextInches: string) {
    setFeet(nextFeet);
    setInches(nextInches);
    if (nextFeet.trim() && nextInches.trim()) {
      try {
        setHeight(String(feetInchesToCentimeters(Number(nextFeet), Number(nextInches))));
      } catch {
        setHeight("");
      }
    } else {
      setHeight("");
    }
    calculatorInputChanged();
  }

  function calculate() {
    setCalculatorMessage("");
    setEstimate(null);
    setSaved(false);
    if (!age.trim() || !height.trim() || !weight.trim() || !sex || !activityLevel) {
      setCalculatorMessage("Complete your age, height, weight, formula option and activity level first. If using feet and inches, fill in both boxes.");
      return;
    }
    try {
      const result = calculateTdee({
        ageYears: Number(age),
        heightCm: Number(height),
        weightKg: Number(weight),
        sex,
        activityLevel,
        goalType,
      });
      setEstimate(result);
      if (result.suggestedCalories === null) {
        if (targetOrigin === "recommended") {
          setCalories("");
          setProtein("");
          setTargetOrigin("none");
        }
        setCalculatorMessage("We can't suggest a safe automatic target for these details. You can review the explanation below.");
        return;
      }
      // Both targets are calculated and filled in together; no second 'use targets' step.
      setCalories(String(result.suggestedCalories));
      setProtein(String(result.suggestedProteinGrams));
      setTargetOrigin("recommended");
      setMessage("");
    } catch (error) {
      setCalculatorMessage(error instanceof Error ? error.message : "Could not calculate your goals.");
    }
  }

  function setCustomCalories(value: string) {
    setCalories(value);
    setEstimate(null);
    setTargetOrigin("custom");
    setSaved(false);
  }
  function setCustomProtein(value: string) {
    setProtein(value);
    setEstimate(null);
    setTargetOrigin("custom");
    setSaved(false);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaved(false);
    const calorieTarget = Number(calories);
    const proteinTarget = Number(protein);
    const targetWeightKg = targetWeight.trim() ? Number(targetWeight) : null;
    if (!calories.trim() || !protein.trim()) {
      setMessage("First select Calculate my targets, or open Adjust my goals to enter your own values.");
      return;
    }
    if (
      !Number.isInteger(calorieTarget) || calorieTarget < 800 || calorieTarget > 6000 ||
      !Number.isInteger(proteinTarget) || proteinTarget < 10 || proteinTarget > 400 ||
      (targetWeightKg !== null && (!Number.isFinite(targetWeightKg) || targetWeightKg < 20 || targetWeightKg > 500))
    ) {
      setMessage("Please check your numbers: calories 800–6000, protein 10–400 g, optional target weight 20–500 kg.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveFitnessGoal({ goalType, calorieTarget, proteinTarget, targetWeightKg });
        setSaved(result.ok);
        setMessage(result.ok ? "Goals saved! Your dashboard will use these targets." : result.message);
      } catch {
        setMessage("Could not save your goals. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={save} className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Calculate your daily goals</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">A few details and we&apos;ll suggest your calories and protein. No maths needed.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Free · 0 AI credits</span>
      </div>

      <label htmlFor="fitness-goal-type" className="mt-5 block text-sm font-semibold text-slate-800">What&apos;s your goal?</label>
      <select
        id="fitness-goal-type"
        className={inputClass}
        value={goalType}
        onChange={(event) => {
          const nextGoal = event.target.value as FitnessGoal;
          if (targetOrigin === "saved" && nextGoal !== initialGoal?.goal_type) {
            setCalories("");
            setProtein("");
            setTargetOrigin("none");
          }
          setGoalType(nextGoal);
          calculatorInputChanged();
        }}
      >
        {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>

      <section aria-labelledby="tdee-title" className="mt-5 border-t border-slate-200 pt-5">
        <h3 id="tdee-title" className="text-base font-bold text-slate-900">Your details</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">We&apos;ll estimate how much energy your body needs each day.</p>
        <div className="mt-5 grid gap-x-6 gap-y-5 lg:grid-cols-2">
          <div>
            <label htmlFor="tdee-age" className="text-sm font-semibold text-slate-800">Age</label>
            <input id="tdee-age" type="number" min="18" max="100" step="1" inputMode="numeric" placeholder="e.g. 22" value={age} onChange={(e) => {setAge(e.target.value);calculatorInputChanged();}} className={inputClass}/>
          </div>
          <div>
            <label htmlFor="tdee-sex" className="text-sm font-semibold text-slate-800">Formula option</label>
            <select id="tdee-sex" className={inputClass} value={sex} onChange={(e) => {setSex(e.target.value as TdeeSex | "");calculatorInputChanged();}}>
              <option value="">Choose an option</option><option value="male">Male equation</option><option value="female">Female equation</option>
            </select>
          </div>
          <div>
            <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span id="tdee-height-label" className="text-sm font-semibold text-slate-800">Height</span>
              <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5" role="group" aria-label="Height units">
                <button type="button" aria-pressed={heightUnit === "feet"} onClick={() => heightUnitChanged("feet")} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${heightUnit === "feet" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>ft / in</button>
                <button type="button" aria-pressed={heightUnit === "cm"} onClick={() => heightUnitChanged("cm")} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${heightUnit === "cm" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>cm</button>
              </div>
            </div>
            {heightUnit === "feet" ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tdee-height-feet" className="text-xs font-medium text-slate-700">Feet</label>
                    <input id="tdee-height-feet" type="number" min="3" max="7" step="1" inputMode="numeric" placeholder="5" value={feet} onChange={(e) => feetOrInchesChanged(e.target.value, inches)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tdee-height-inches" className="text-xs font-medium text-slate-700">Inches</label>
                    <input id="tdee-height-inches" type="number" min="0" max="11.9" step="0.1" inputMode="decimal" placeholder="5" value={inches} onChange={(e) => feetOrInchesChanged(feet, e.target.value)} className={inputClass} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500" aria-live="polite">{height ? `About ${height} cm` : "Example: 5 ft 5 in"}</p>
              </>
            ) : (
              <div className="mt-1">
                <label htmlFor="tdee-height" className="sr-only">Height in centimetres</label>
                <input id="tdee-height" type="number" min="120" max="230" step="0.1" inputMode="decimal" placeholder="e.g. 165" value={height} onChange={(e) => {setHeight(e.target.value);calculatorInputChanged();}} className={inputClass}/>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="tdee-weight" className="block min-h-6 text-sm font-semibold text-slate-800">Current weight (kg)</label>
            <input id="tdee-weight" type="number" min="30" max="250" step="0.1" inputMode="decimal" placeholder="e.g. 80" value={weight} onChange={(e) => {setWeight(e.target.value);calculatorInputChanged();}} className={inputClass}/>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="tdee-activity" className="text-sm font-semibold text-slate-800">How active are you?</label>
            <select id="tdee-activity" value={activityLevel} onChange={(e) => {setActivityLevel(e.target.value as TdeeActivityLevel | "");calculatorInputChanged();}} className={`${inputClass} max-w-xl`}>
              <option value="">Choose your activity level</option>
              {Object.entries(TDEE_ACTIVITY_LEVELS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
            </select>
            <p className="mt-1 text-xs leading-5 text-slate-500">Include activity at work and at home too.</p>
          </div>
        </div>
        <button type="button" onClick={calculate} className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto">Calculate my targets</button>
        {calculatorMessage && <p role="alert" className="mt-3 text-sm text-amber-900">{calculatorMessage}</p>}
        {estimate?.caution && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{estimate.caution}</p>}
        {estimate && <details className="mt-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold">How were these goals calculated?</summary>
          <p className="mt-2 leading-6">Estimated maintenance calories (TDEE): {estimate.maintenanceCalories.toLocaleString()} kcal/day. Resting energy needs (BMR): {estimate.bmrCalories.toLocaleString()} kcal/day. BMI: {estimate.bmi.toFixed(1)} (reference only, not a diagnosis). {estimate.explanation}</p>
        </details>}
        <p className="mt-3 text-xs leading-5 text-slate-500">For adults 18+. Estimates use sex-based equation constants and may not fit everyone, including during pregnancy, breastfeeding or with certain medical conditions. These measurements are not saved.</p>
      </section>

      {(calories.trim() !== "" && protein.trim() !== "") ? (
        <section aria-labelledby="recommended-title" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4" aria-live="polite">
          <h3 id="recommended-title" className="text-base font-bold text-slate-900">Your daily goals {targetOrigin === "recommended" ? "— calculated for you" : targetOrigin === "saved" ? "— previously saved" : "— customised"}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold text-slate-700">Calories to eat</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-800">{Number(calories).toLocaleString()} <span className="text-sm font-normal">kcal/day</span></p>
              <p className="mt-1 text-xs text-slate-600">Starting target for your goal.</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold text-slate-700">Protein suggestion</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{Number(protein).toLocaleString()} <span className="text-sm font-normal">g/day</span></p>
              <p className="mt-1 text-xs text-slate-600">Helpful for muscle health. Not a strict requirement.</p>
            </div>
          </div>
          {targetOrigin === "recommended" && <p className="mt-2 text-xs text-emerald-800">Both targets were filled in automatically. You can save them below.</p>}
        </section>
      ) : (
        <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{initialGoal ? "Your existing goals remain saved until you choose new ones." : "Complete the calculator to see your daily calorie and protein goals."}</p>
      )}

      <details className="mt-4 rounded-xl border border-slate-200 p-3 sm:p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Adjust my goals (optional)</summary>
        <p className="mt-2 text-xs leading-5 text-slate-600">Beginners can keep the recommended numbers. You may also enter your own targets.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="calorie-target" className="text-sm font-semibold text-slate-700">Daily food calories (kcal)</label>
            <input id="calorie-target" type="number" min="800" max="6000" step="1" inputMode="numeric" className={inputClass} value={calories} onChange={(e) => setCustomCalories(e.target.value)} placeholder="Calculated for you" />
          </div>
          <div>
            <label htmlFor="protein-target" className="text-sm font-semibold text-slate-700">Daily protein (grams)</label>
            <input id="protein-target" type="number" min="10" max="400" step="1" inputMode="numeric" className={inputClass} value={protein} onChange={(e) => setCustomProtein(e.target.value)} placeholder="Calculated for you" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="target-weight" className="text-sm font-semibold text-slate-700">Target body weight (kg) <span className="font-normal text-slate-500">optional</span></label>
            <input id="target-weight" type="number" min="20" max="500" step="0.1" inputMode="decimal" className={inputClass} value={targetWeight} onChange={(e) => {setTargetWeight(e.target.value);setSaved(false);}} placeholder="Leave blank if unsure" />
          </div>
        </div>
      </details>
      <p className="mt-3 text-xs leading-5 text-slate-500">Estimates are starting points, not medical advice. Exercise doesn&apos;t automatically increase your food calorie budget.</p>
      <button disabled={pending} type="submit" className="mt-4 min-h-11 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto">
        {pending ? "Saving…" : "Save my goals"}
      </button>
      {message && <p role="status" className={`mt-3 text-sm ${saved ? "text-emerald-700" : "text-slate-700"}`}>{message}</p>}
    </form>
  );
}
