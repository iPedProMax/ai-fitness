import { describe, expect, it } from "vitest";
import { buildCommunityIndex, searchCommunityIndex } from "./ph-community-parser";

const header = "barcode,product_name,brand,package_quantity,serving_size,category,calories_100g,protein_100g,carbs_100g,fat_100g,fiber_100g,sugar_100g,sodium_mg_100g,priority_score,license,source_url";
const source = "https://world.openfoodfacts.org/product/4800016552113";
const csv = `\uFEFF${header}\r\n4800016552113,"Sample, Noodles",Nissin,40 g,40 g,noodles,170,4,24,7,,,,20,ODbL 1.0,${source}\r\n4800016552114,Example Rice,Sample,100 g,100 g,rice,,2,25,,,,,9,ODbL 1.0,https://world.openfoodfacts.org/product/4800016552114\r\n`;

describe("Philippine community catalog fallback", () => {
  const records = buildCommunityIndex(csv);
  it("retains only source-backed barcodes and parses quoted CSV", () => {
    expect(records).toHaveLength(2);
    expect(records[0].food.name).toBe("Sample, Noodles");
  });
  it("fills real nutrients, but preserves unknown instead of turning it into zero", () => {
    expect(records[0].food.calories100g).toBe(170);
    expect(records[1].food.calories100g).toBeNull();
    expect(records[1].food.fat100g).toBeNull();
  });
  it("matches exact barcode and multiword text", () => {
    expect(searchCommunityIndex(records, "barcode", "4800016552113")).toHaveLength(1);
    expect(searchCommunityIndex(records, "search", "nissin noodles")).toHaveLength(1);
    expect(searchCommunityIndex(records, "search", "rice")).toHaveLength(1);
  });
  it("doesn't ingest data claiming the wrong license", () => {
    expect(buildCommunityIndex(csv.replace(/ODbL 1\.0/g, "Unknown"))).toHaveLength(0);
  });
});
