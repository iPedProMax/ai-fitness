import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,it,expect} from "vitest";

describe("Z3.3 catalog-first barcode UI behavior",()=>{
  const barcode=readFileSync(join(process.cwd(),"src/components/barcode-lookup.tsx"),"utf8");
  it("uses existing catalog portion values before any AI draft",()=>{
    expect(barcode).toContain("nutritionForGrams(selected,Number(grams)");
    expect(barcode).toContain("barcodeNutritionCoverage(portion)");
    expect(barcode).toContain('Nutrition auto-filled from {selected && "nutritionSourceUrl" in selected ? "an exact-barcode community cross-reference" : catalogSource}');
    expect(barcode).toContain('Still missing: {currentCoverage.missing.join(", ")}');
  });
  it("only offers Text AI when calories/macros are missing",()=>{
    expect(barcode).toContain("!currentCoverage.allKnown&&<button");
    expect(barcode).toContain("{textAiOpen&&<BarcodeAiTextAssist");
    expect(barcode).toContain("1 credit");
    expect(barcode).not.toContain("analyzeLabelPhotos");
  });
});
