import { ADVANCED_NUTRIENT_FIELDS } from "./advanced-nutrients";
import type { AdvancedNutrients } from "./advanced-nutrients";

export function summarizeExpandedNutrients(foods: readonly {advancedNutrients?: AdvancedNutrients}[]) {
  return ADVANCED_NUTRIENT_FIELDS.map(field => {
    let known=0,missing=0,total=0;
    for (const food of foods) {
      const value=food.advancedNutrients?.[field.key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {known++;total+=value;}
      else missing++;
    }
    const formatted = Number(total.toFixed(1)).toLocaleString("en-PH", {maximumFractionDigits:1});
    return {key:field.key,label:field.label,unit:field.unit,total,known,missing,
      display: known ? `${formatted} ${field.unit}${missing ? "+" : ""}` : "Unknown"};
  });
}