import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

const root=process.cwd();
const barcode=readFileSync(join(root,"src/components/barcode-lookup.tsx"),"utf8");
const helper=readFileSync(join(root,"src/components/barcode-ai-text-assist.tsx"),"utf8");

describe("Z3.1 barcode Text AI layout safeguards",()=>{
  it("keeps the AI form contextual rather than a standalone full-size panel",()=>{
    expect((barcode.match(/<BarcodeAiTextAssist/g)??[]).length).toBe(2);
    expect(barcode).toContain("{noResult&&<div");
    expect(barcode).toContain("{textAiOpen&&<BarcodeAiTextAssist");
    expect(barcode).not.toContain("(selected||noResult)&&textAiOpen&&<BarcodeAiTextAssist");
  });
  it("hides inputs and the provider selector when no approved Text AI is available",()=>{
    expect(helper).toContain("!isReady ? (");
    expect(helper).toContain("No approved provider is ready");
    expect(helper).toContain("readyTextAiIds(statuses)");
    expect(helper).not.toContain("AiProviderPicker");
    expect(helper).toContain('id !== "ollama-local" || localTextReady');
  });
  it("never uses barcode vision analysis or automatically saves a draft",()=>{
    expect(helper).toContain("analyzeFoodText(");
    expect(helper).not.toContain("analyzeFood(");
    expect(helper).toContain("window.confirm(");
    expect(barcode).toContain("onDraft={applyTextAiDraft}");
  });
});
