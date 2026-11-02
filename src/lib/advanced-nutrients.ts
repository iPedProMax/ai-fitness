import { z } from "zod";

/** Optional nutrient readings; absent means Unknown, including for AI-generated meals. */
export const advancedNutrientsSchema = z.object({
 fiberG: z.number().finite().min(0).max(1000).optional(),
 sugarG: z.number().finite().min(0).max(1000).optional(),
 addedSugarG: z.number().finite().min(0).max(1000).optional(),
 sodiumMg: z.number().finite().min(0).max(100000).optional(),
 cholesterolMg: z.number().finite().min(0).max(100000).optional(),
 potassiumMg: z.number().finite().min(0).max(100000).optional(),
 calciumMg: z.number().finite().min(0).max(100000).optional(),
 ironMg: z.number().finite().min(0).max(100000).optional(),
 vitaminDMcg: z.number().finite().min(0).max(1000).optional(),
 // Legacy saved data may contain this field. Keep readable for compatibility,
 // but do not include it in new public food entry or reports.
 saturatedFatG: z.number().finite().min(0).max(1000).optional(),
}).strict();
export type AdvancedNutrients = z.infer<typeof advancedNutrientsSchema>;
export type AdvancedNutrientKey = keyof AdvancedNutrients;
export const ADVANCED_NUTRIENT_FIELDS = [
 {key:"fiberG",label:"Fiber",unit:"g"},
 {key:"sugarG",label:"Total sugar",unit:"g"},
 {key:"sodiumMg",label:"Sodium",unit:"mg"},
 {key:"cholesterolMg",label:"Cholesterol",unit:"mg"},
 {key:"potassiumMg",label:"Potassium",unit:"mg"},
 {key:"calciumMg",label:"Calcium",unit:"mg"},
 {key:"ironMg",label:"Iron",unit:"mg"},
 {key:"vitaminDMcg",label:"Vitamin D",unit:"mcg"},
] as const;
export function unitForNutrient(key: AdvancedNutrientKey): "g"|"mg"|"mcg" {
 return key === "vitaminDMcg" ? "mcg" : key.endsWith("Mg") ? "mg" : "g";
}
export function displayAdvancedNutrient(values: AdvancedNutrients|null|undefined,key: AdvancedNutrientKey): string {
 const value=values?.[key];
 if(typeof value!=="number"||!Number.isFinite(value)||value<0)return "Unknown";
 return Number(value.toFixed(1)).toLocaleString("en-PH",{maximumFractionDigits:1})+" "+unitForNutrient(key);
}
/** Only match a food by name when unambiguous; otherwise Unknown. */
export function findAdvancedForNamedFood(
 foods: readonly {name?:string;advancedNutrients?: AdvancedNutrients}[]|null|undefined,name:string
):AdvancedNutrients|undefined {
 const target=name.trim().toLocaleLowerCase();
 if(!target)return undefined;
 const matches=(foods??[]).filter(food=>food.name?.trim().toLocaleLowerCase()===target);
 return matches.length===1?matches[0].advancedNutrients:undefined;
}
