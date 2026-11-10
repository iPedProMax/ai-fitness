import { describe, expect, it } from "vitest";
import { catalogSourceLabel } from "./catalog-source-label";

describe("Q4.11A: barcode catalog provenance labels", () => {
  it("preserves reviewed Khalories label attribution", () => {
    expect(catalogSourceLabel("Khalories Philippine Food Library"))
      .toBe("Khalories Philippine Food Library");
  });
  it("distinguishes local PH community food from live Open Food Facts", () => {
    expect(catalogSourceLabel("Open Food Facts PH-tagged community (may include cross-referenced nutrients)"))
      .toBe("PH community catalog");
    expect(catalogSourceLabel("Open Food Facts")).toBe("Open Food Facts");
  });
  it("shows exact-barcode references as references rather than Open Food Facts", () => {
    expect(catalogSourceLabel("Community barcode nutrition cross-reference"))
      .toBe("Community barcode reference");
  });
  it("does not render arbitrary source strings from an untrusted response", () => {
    expect(catalogSourceLabel(null)).toBe("Food catalog");
    expect(catalogSourceLabel("Untrusted custom source")).toBe("Food catalog");
    expect(catalogSourceLabel({ source: "Open Food Facts" })).toBe("Food catalog");
  });
});
