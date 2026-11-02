import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findFoodContextWarnings as review } from "./food-context-review";

const row = (name: string, grams = "150", calories = "200") => [{ name, grams, calories }];

describe("Phase U10B Filipino food context review", () => {
  it("does not flag a clearly cooked rice and boiled-egg example", () => {
    expect(review([ ...row("Cooked white rice"), ...row("Boiled egg") ],
      "150g cooked white rice and 1 large boiled egg")).toEqual([]);
  });
  it("requests raw/cooked clarification only for measured ambiguous food", () => {
    expect(review(row("White rice"), "150g white rice").join(" ")).toContain("raw or cooked");
    expect(review(row("White rice"), "one bowl of white rice")).toEqual([]);
  });
  it("distinguishes fish whole weight from edible portions", () => {
    expect(review(row("Grilled bangus"), "200g grilled bangus").join(" ")).toContain("head/bones");
    expect(review(row("Grilled bangus"), "200g grilled boneless bangus fillet")).toEqual([]);
  });
  it("notes missing broth/solid composition for sinigang", () => {
    expect(review(row("Sinigang na baboy"), "1 bowl sinigang na baboy").join(" ")).toContain("broth");
    expect(review(row("Sinigang na baboy"), "1 bowl sinigang na baboy with broth")).toEqual([]);
  });
  it("notes recipe differences for adobo without inventing nutrients", () => {
    expect(review(row("Chicken adobo"), "chicken adobo").join(" ")).toContain("oil/sauce");
    expect(review(row("Chicken adobo"), "chicken adobo, sauce 30g")).toEqual([]);
    expect(review(row("Chicken adobo"), "chicken adobo with 30g sauce")).toEqual([]);
    expect(review(row("Chicken adobo"), "chicken adobo, chicken 150g, sauce 30g").join(" ")).toContain("raw or cooked");
    expect(review(row("Chicken adobo"), "chicken adobo, sauce 30g, chicken 150g").join(" ")).toContain("raw or cooked");
  });
  it("questions per-stick pork BBQ estimates only when meat weight is missing", () => {
    expect(review(row("Pork BBQ"), "2 pork BBQ sticks").join(" ")).toContain("edible meat weight");
    expect(review(row("Pork BBQ"), "2 pork BBQ sticks, 120g grilled edible pork")).toEqual([]);
  });
  it("does not warn for unrelated foods or mutate entered nutrition data", () => {
    const rows = row("Banana", "100", "89");
    const original = JSON.stringify(rows);
    expect(review(rows, "100g banana")).toEqual([]);
    expect(JSON.stringify(rows)).toBe(original);
  });
  it("wires warnings as review-only and asks the model to respect preparation", () => {
    const component = readFileSync(join(process.cwd(), "src/components/log-food-panel.tsx"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/app/api/food/text/route.ts"), "utf8");
    expect(component).toContain("aiAssisted ? findFoodContextWarnings(items, description) : []");
    expect(component).toContain("Nothing is changed automatically");
    expect(route).toContain("For Filipino dishes such as adobo, sinigang, tinola, pancit, bangus, and pork BBQ");
    expect(route).toContain("raw or cooked, with bones or edible portion");
  });
});