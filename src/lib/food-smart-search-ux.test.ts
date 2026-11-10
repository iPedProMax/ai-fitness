import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Z3.4.1 food search UX regression", () => {
  it("uses a single result area, no duplicate empty-reviewed-library panel", () => {
    const page = file("src/app/foods/page.tsx");
    expect(page).toContain('<FoodSmartSearch mode="browse"');
    expect(page).not.toContain("No reviewed library match yet");
    expect(page).not.toContain("findReviewedPhilippineFoods");
  });
  it("searches external community records only from a user submit", () => {
    const component = file("src/components/food-smart-search.tsx");
    expect(component).toContain('form onSubmit={submit}');
    expect(component).toContain('void searchAll(searchText)');
    expect(component).toContain('/api/food/catalog?q=');
    expect(component).toContain('/api/food/library/suggest?q=');
    expect(component).not.toContain('Search wider food database (free)');
    expect(component).not.toContain('No reviewed local product suggested yet');
  });
  it("keeps both manual autofill and barcode review routes", () => {
    const component = file("src/components/food-smart-search.tsx");
    expect(component).toContain('onSelect(food, source)');
    expect(component).toContain('mode=barcode&barcode=');
    expect(component).toContain('Community records may be incomplete');
    expect(component).toContain('Nutrition not listed');
  });
});
