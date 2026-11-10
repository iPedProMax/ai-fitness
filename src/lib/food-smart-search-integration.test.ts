import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Z3.4 search integration", () => {
  it("wires suggestions to both Food Library and Manual food entry", () => {
    const root = process.cwd();
    const browse = readFileSync(join(root, "src/app/foods/page.tsx"), "utf8");
    const manual = readFileSync(join(root, "src/components/log-food-panel.tsx"), "utf8");
    const barcode = readFileSync(join(root, "src/components/barcode-lookup.tsx"), "utf8");
    const search = readFileSync(join(root, "src/components/food-smart-search.tsx"), "utf8");
    expect(browse).toContain('mode="browse"');
    expect(manual).toContain('mode="manual"');
    expect(manual).toContain("nutritionForGrams(food, amount)");
    expect(barcode).toContain('params.get("barcode")');
    expect(search).toContain('/api/food/library/suggest?q=');
    expect(search).toContain('/api/food/catalog?q=');
  });
});
