import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const barcode = read("src/components/barcode-lookup.tsx");
const helper = read("src/components/barcode-ai-text-assist.tsx");

describe("Q4.9/Q4.10 Barcode Text AI provider selection", () => {
  it("shows the provider selector before barcode upload and scan controls", () => {
    const selector = barcode.indexOf('id="barcode-text-ai-provider"');
    const scanner = barcode.indexOf('onClick={()=>scanning?stopCamera():void startCamera()}');
    expect(selector).toBeGreaterThan(0);
    expect(scanner).toBeGreaterThan(selector);
    expect(barcode).toContain('Choose your nutrition AI');
    expect(barcode).toContain('1 credit only when you run AI');
  });

  it("only offers server-approved ready text providers", () => {
    expect(barcode).toContain('readyTextAiIds(textAiStatuses)');
    expect(barcode).toContain('id!=="ollama-local"||localTextReady');
    expect(barcode).toContain('readyBarcodeTextIds.map(id=><option');
    expect(barcode).toContain('readyBarcodeTextIds.length===0');
    expect(helper).toContain('readyTextAiIds(statuses)');
    expect(helper).not.toContain('AiProviderPicker');
    expect(helper).toContain('No approved provider is ready');
  });

  it("passes the selection to both existing AI-helper paths without auto-charging", () => {
    expect((barcode.match(/preferredProvider={chosenBarcodeTextProvider}/g)??[]).length).toBe(2);
    expect(helper).toContain('preferredProvider && ready.includes(preferredProvider)');
    expect(helper).toContain('analyzeFoodText(description.slice(0, 600), { modelId: selected })');
    expect(helper).toContain('window.confirm(');
    expect(helper).not.toContain('analyzeFood(');
    expect(barcode).toContain('onDraft={applyTextAiDraft}');
  });
});
