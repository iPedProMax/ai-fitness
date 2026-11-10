import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
describe("Q4.16B Log Food layout and barcode save regression", () => {
  it("keeps manual input full-width while a meal result is open", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain('entryMode === "manual"\n                ? "mx-auto w-full max-w-4xl space-y-6"');
    expect(page).toContain('<section className="mx-auto w-full min-w-0 max-w-4xl"><BarcodeLookup /></section>');
  });
  it("does not force an impossible two-column manual editor at medium viewports", () => {
    const manual = read("src/components/log-food-panel.tsx");
    expect(manual).toContain("2xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.64fr)]");
    expect(manual).toContain("grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2");
  });
  it("requires review then shows only one Add Meal component for selected barcode food", () => {
    const barcode = read("src/components/barcode-lookup.tsx");
    expect(barcode).toContain("quickLogAnalysis && !analysis");
    expect(barcode).not.toContain("<AddMealButton analysis={quickLogAnalysis}/>");
    expect(barcode).toContain("<AddMealButton analysis={analysis}/>");
    expect(barcode).toContain("Review nutrition &amp; continue to save");
  });
  it("keeps strict My Foods schema, strips catalog-only metadata and avoids raw validation dumps", () => {
    const logic = read("src/lib/personal-barcode-food.ts");
    const barcode = read("src/components/barcode-lookup.tsx");
    expect(logic).toContain("personalBarcodeFoodSchema.parse({");
    expect(logic).toContain("barcode:base.barcode,");
    expect(logic).not.toContain("...base,");
    expect(barcode).toContain('error.name !== "ZodError"');
  });
});
