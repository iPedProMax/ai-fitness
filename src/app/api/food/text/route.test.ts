import { describe, it, expect } from "vitest";
import { validateFoodText } from "@/lib/food-text-input";
describe("text food request validation", () => {
  it("accepts a meaningful food description", () => expect(validateFoodText({description:"200 g cooked rice"})).toBe("200 g cooked rice"));
  it("rejects invalid or oversized data", () => {
    expect(validateFoodText(null)).toBeNull();
    expect(validateFoodText({description:" "})).toBeNull();
    expect(validateFoodText({description:"x".repeat(601)})).toBeNull();
  });
});
