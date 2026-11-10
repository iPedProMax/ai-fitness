import { describe, expect, it } from "vitest";
import { foodMatchScore, normalizeSmartFoodQuery, smartFoodTokens } from "./food-smart-query";

describe("Z3.4 library smart search", () => {
  it("normalizes dangerous query syntax before database filtering", () => {
    expect(normalizeSmartFoodQuery("  Nissin%__ (beef), cup\\noodles  ")).toBe("Nissin beef cup noodles");
    expect(smartFoodTokens("Nissin cup noodles beef")).toEqual(["nissin", "cup", "noodles", "beef"]);
  });
  it("matches reorderings of brand, product and flavor", () => {
    const exact = { name: "Cup Noodles Beef", brand: "Nissin" };
    const partial = { name: "Nissin Cup Noodles Seafood", brand: "Nissin" };
    expect(foodMatchScore(exact, "nissin cup noodles beef")).toBeGreaterThan(foodMatchScore(partial, "nissin cup noodles beef"));
  });
  it("does not recommend unrelated products or confuse zero with unknown", () => {
    expect(foodMatchScore({ name: "Tuna", brand: "Century" }, "nissin noodles")).toBe(0);
  });
});
