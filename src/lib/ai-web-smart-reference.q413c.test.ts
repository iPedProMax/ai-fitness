import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ManualFoodInput } from "./manual-food";
import { applySmartFoodReference, findLocalSmartReferences, readCatalogSmartReferences } from "./ai-web-smart-reference";

const emptyOats: ManualFoodInput = { name:"Dry rolled oats", grams:"70.6", calories:"", protein:"", carbs:"", fat:"" };
const oats = () => {
  const ref = findLocalSmartReferences("Dry rolled oats").find(r => r.id === "local:staple-oats-dry-raw");
  if (!ref) throw new Error("USDA oats reference missing");
  return ref;
};

describe("Q4.13C human-confirmed nutrition reference autofill", () => {
  it("finds generic raw dry oats offline, never labels it as Quaker", () => {
    const found = oats();
    expect(found.origin).toBe("USDA_LOCAL");
    expect(found.name).toContain("generic");
    expect(found.source).toContain("USDA");
    expect(found.per100g.calories).toBe(389);
    expect(found.per100g.sugarG).toBeNull();
  });
  it("requires explicit confirmation that weight is net food weight", () => {
    expect(() => applySmartFoodReference(emptyOats, oats(), false)).toThrow(/Confirm net food weight/);
    expect(() => applySmartFoodReference({ ...emptyOats, grams:"" }, oats(), true)).toThrow(/net food weight/);
    expect(() => applySmartFoodReference({ ...emptyOats, grams:"70.6g" }, oats(), true)).toThrow();
  });
  it("fills only missing fields, scales from 100g, and preserves unknown as blank", () => {
    const { item, filled } = applySmartFoodReference({ ...emptyOats, calories:"262" }, oats(), true);
    expect(item.calories).toBe("262"); // never silently overwrite the AI value
    expect(item.protein).toBe("11.92");
    expect(item.carbs).toBe("46.79");
    expect(item.fat).toBe("4.87");
    expect(item.fiberG).toBe("7.48");
    expect(item.sugarG).toBeUndefined();
    expect(filled).not.toContain("sugarG");
  });
  it("replaces AI estimates only on the user's explicit replace action", () => {
    const { item } = applySmartFoodReference({ ...emptyOats, calories:"351", protein:"6.8" }, oats(), true, "replace");
    expect(item.calories).toBe("274.63");
    expect(item.protein).toBe("11.92");
    expect(item.name).toBe("Dry rolled oats");
    expect(item.grams).toBe("70.6");
  });
  it("rejects 0, over-limit and unverified portion weights", () => {
    expect(() => applySmartFoodReference({ ...emptyOats, grams:"0" }, oats(), true)).toThrow();
    expect(() => applySmartFoodReference({ ...emptyOats, grams:"3000" }, oats(), true)).toThrow();
  });
  it("parses existing catalog format with provenance without inventing missing advanced nutrients", () => {
    const matches = readCatalogSmartReferences({
      source:"Open Food Facts", foods:[{name:"Oats, plain", brand:"Sample Brand", calories100g:370, protein100g:12, carbs100g:66, fat100g:7, advancedNutrients100g:{fiberG:9,sugarG:null,sodiumMg:0}}],
    });
    expect(matches).toHaveLength(1);
    const filled = applySmartFoodReference(emptyOats, matches[0], true).item;
    expect(filled.calories).toBe("261.22");
    expect(filled.sodiumMg).toBe("0"); // genuine source zero is not unknown
    expect(filled.sugarG).toBeUndefined();
    expect(matches[0].source).toBe("Open Food Facts");
  });
  it("rejects invalid catalog rows and unsafe source URLs", () => {
    const result = readCatalogSmartReferences({ source:"Community", foods:[
      { name:"Bad food", calories100g:50000 },
      { name:"Legit food", calories100g:100, sourceUrl:"javascript:alert(1)" },
    ] });
    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBeUndefined();
    expect(result[0].name).toBe("Legit food");
  });
  it("wires the UI to manual opt-in, existing catalog lookup and existing reviewed-save flow", () => {
    const panel = readFileSync(join(process.cwd(), "src/components/external-gemini-import-panel.tsx"), "utf8");
    expect(panel).toContain("findLocalSmartReferences");
    expect(panel).toContain("applySmartFoodReference");
    expect(panel).toContain("netWeightConfirmed");
    expect(panel).toContain("/api/food/catalog?q=");
    expect(panel).toContain("makeReviewedExternalFoodAnalysis");
    expect(panel).not.toContain("/api/food/analyze");
  });
});
