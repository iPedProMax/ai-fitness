import { describe, it, expect } from "vitest";
import { foodEmoji } from "./food-emoji";
describe("manual food icons", () => {
  it("recognizes Filipino and common foods", () => {
    expect(foodEmoji("Grilled bangus")).toBe("🐟");
    expect(foodEmoji("Cooked white rice")).toBe("🍚");
    expect(foodEmoji("Quaker Oats")).toBe("🥣");
  });
  it("falls back to a plate", () => expect(foodEmoji("Unrecognized dish")).toBe("🍽️"));
});
