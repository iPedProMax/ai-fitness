import type { CatalogFood } from "@/lib/open-food-facts";
export type ServingOption={label:string; grams:number};
/** Grams only: we intentionally do NOT assume density for mL or fluid ounces. */
export function gramsFromLabel(value: string): number | null {
  if (!value || value.length > 100) return null;
  const matches=[...value.matchAll(/(?:^|[^a-z0-9])([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|grams?)(?![a-z])/gi)];
  if (matches.length !== 1) return null; // ambiguous multi-pack/weight strings
  const parsed=Number(matches[0][1].replace(",","."));
  const grams=parsed*(matches[0][2].toLowerCase()==="kg"?1000:1);
  return Number.isFinite(grams) && grams>=1 && grams<=2000 ? grams : null;
}
export function suggestedServings(food:CatalogFood):ServingOption[] {
  const options:ServingOption[]=[{label:"100 g",grams:100}];
  const serving=gramsFromLabel(food.servingDescription);
  if(serving!==null && serving!==100) options.unshift({label:`1 serving (${serving} g)`,grams:serving});
  const pack=gramsFromLabel(food.packageDescription??"");
  if(pack!==null && pack!==100 && pack!==serving)options.push({label:`1 package (${pack} g)`,grams:pack});
  return options;
}
