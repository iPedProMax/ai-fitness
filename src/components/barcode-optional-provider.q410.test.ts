import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const read=(f:string)=>readFileSync(join(process.cwd(),f),"utf8");
const barcode=read("src/components/barcode-lookup.tsx");
const helper=read("src/components/barcode-ai-text-assist.tsx");

describe("Q4.10 Barcode optional AI first-encounter UX",()=>{
  it("shows a clear free-first explanation and explicit optional credit cost",()=>{
    expect(barcode).toContain('No AI credits for barcode lookups');
    expect(barcode).toContain('First, find a product for free');
    expect(barcode).toContain('only requesting an estimate uses 1 credit');
  });
  it("keeps one primary provider dropdown outside optional form/details",()=>{
    expect((barcode.match(/id="barcode-text-ai-provider"/g)??[]).length).toBe(1);
    expect(helper).not.toContain('<select id="barcode-text-ai-provider"');
    expect(helper).toContain('Use the provider selector above the barcode scanner');
  });
  it("remains a text-only, user-confirmed action independent from saving",()=>{
    expect(helper).toContain('window.confirm(');
    expect(helper).toContain('analyzeFoodText(description.slice(0, 600), { modelId: selected })');
    expect(helper).not.toContain('analyzeFood(');
    expect(helper).not.toContain('AddMealButton');
    expect(barcode).toContain('onDraft={applyTextAiDraft}');
  });
});
