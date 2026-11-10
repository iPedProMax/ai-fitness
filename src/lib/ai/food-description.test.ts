import { describe, expect, it } from "vitest";
import { formatFoodDescriptionContext, MAX_FOOD_DESCRIPTION_LENGTH,
  normalizeFoodDescription, FOOD_DESCRIPTION_PREFIX } from "./food-description";

describe("optional scanner food description", () => {
  it("keeps blank scans optional", () => {
    expect(normalizeFoodDescription(null)).toBe("");
    expect(normalizeFoodDescription("")).toBe("");
    expect(formatFoodDescriptionContext("")).toBe("");
  });
  it("trims and normalizes spaces, preserving useful portion context", () => {
    expect(normalizeFoodDescription("  70.6g  dry\nQuaker oats  "))
      .toBe("70.6g dry Quaker oats");
  });
  it("rejects non-text and overlong inputs", () => {
    expect(normalizeFoodDescription({ fake: "food" })).toBeNull();
    expect(normalizeFoodDescription("x".repeat(MAX_FOOD_DESCRIPTION_LENGTH + 1))).toBeNull();
    expect(normalizeFoodDescription("x".repeat(MAX_FOOD_DESCRIPTION_LENGTH))).toHaveLength(400);
  });
  it("marks food context as unverified and cannot silently authorize tare", () => {
    const text = formatFoodDescriptionContext("Quaker rolled oats, scale 70.6g");
    expect(text.startsWith(FOOD_DESCRIPTION_PREFIX)).toBe(true);
    expect(text).toContain("unverified USER-SUPPLIED FOOD CONTEXT");
    expect(text).toContain("Do not assume a bowl or container was tared");
  });
  it("encodes the user value as a JSON string rather than unquoted prompt text", () => {
    const text = formatFoodDescriptionContext('oats "maybe"');
    expect(text).toContain(JSON.stringify('oats "maybe"'));
  });
});
