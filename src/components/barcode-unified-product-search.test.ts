import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("Z4 Q4.3: one product search in Barcode", () => {
  it("offers one searchable catalog component without the duplicate advanced search form", () => {
    const barcode = source("src/components/barcode-lookup.tsx");
    const search = source("src/components/food-smart-search.tsx");
    expect(barcode).toContain('<FoodSmartSearch mode="barcode"');
    expect(barcode).not.toContain("Advanced product search");
    expect(barcode).not.toContain("Or search food products");
    expect(search).toContain('mode === "barcode" ? "Find the exact packaged food"');
    expect(search).toContain('/api/food/library/suggest?q=');
    expect(search).toContain('/api/food/catalog?q=');
    expect(search).toContain('onSubmit={submit}');
    expect(search).toContain('void searchAll(searchText)');
  });
  it("preserves typed text for the existing Barcode Text AI helper", () => {
    const barcode = source("src/components/barcode-lookup.tsx");
    const search = source("src/components/food-smart-search.tsx");
    expect(barcode).toContain('onQueryChange={setSearch}');
    expect(barcode).toContain('initialName={manualValues.name||search}');
    expect(search).toContain('onQueryChange?.(event.target.value)');
    expect(barcode).toContain('BarcodeAiTextAssist');
  });
  it("keeps real source attribution and existing no-credit nutrition autofill", () => {
    const barcode = source("src/components/barcode-lookup.tsx");
    const search = source("src/components/food-smart-search.tsx");
    expect(barcode).toContain('onSelect={(food, source) => {');
    expect(barcode).toContain('setCatalogSource(source)');
    expect(barcode).toContain('choose(food)');
    expect(barcode).toContain('nutritionForGrams(selected,Number(grams)');
    expect(barcode).toContain('"nutritionSourceUrl" in selected');
    expect(search).toContain('onSelect(food, source)');
    expect(search).toContain('visibleLocalCommunity');
  });
});
