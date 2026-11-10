import { ADVANCED_NUTRIENT_FIELDS, displayAdvancedNutrient, type AdvancedNutrients } from "@/lib/advanced-nutrients";

/** Disclosure is read-only; opening it makes no network/AI calls. */
export function AdvancedNutrientsSummary({ values }: { values?: AdvancedNutrients | null }) {
  const known = ADVANCED_NUTRIENT_FIELDS.filter(field => values?.[field.key] !== undefined).length;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500">
        Advanced nutrients {known ? `(${known}/${ADVANCED_NUTRIENT_FIELDS.length} available)` : "(all unknown)"}
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ADVANCED_NUTRIENT_FIELDS.map(field => (
          <div key={field.key} className="rounded-lg bg-white p-2">
            <p className="text-[11px] text-slate-500">{field.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">{displayAdvancedNutrient(values, field.key)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Available values are included in the meal when you press Add Meal; saved meals retain those values. Unknown means no reliable value was supplied. You can enter missing values from a label in the nutrition editor.</p>
    </details>
  );
}