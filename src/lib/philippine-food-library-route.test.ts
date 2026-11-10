import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

describe("Z3.2 barcode library-first wiring", () => {
  const barcode = readFileSync(join(process.cwd(),"src/components/barcode-lookup.tsx"),"utf8");
  const route = readFileSync(join(process.cwd(),"src/app/api/food/catalog/route.ts"),"utf8");
  const sql = readFileSync(join(process.cwd(),"docs/khalories_ph_food_library_staging.sql"),"utf8");
  it("looks up published library records before contacting the community API", () => {
    expect(route.indexOf('findReviewedPhilippineFoods(kind, barcode || query)'))
      .toBeLessThan(route.indexOf('await fetch(url'));
    expect(route).toContain('source:"Khalories Philippine Food Library"');
  });
  it("does not allow stale personal browser cache to bypass exact barcode matches", () => {
    expect(barcode).toContain('type === "barcode" ? null : readCatalogCache(type,value)');
  });
  it("never makes user submissions or AI estimates publicly visible", () => {
    expect(sql).toContain("USING (status = 'published')");
    expect(sql).toContain('TO authenticated');
    expect(sql).not.toContain('source_kind IN (\'ai_estimate\'');
    expect(sql).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL).*\sTO\s+authenticated/i);
  });
});
