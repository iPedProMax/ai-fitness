import { describe, expect, it } from "vitest";
import { fitMealThumbnail, THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_EDGE } from "./meal-thumbnail";

describe("private meal thumbnail sizing", () => {
  it("shrinks HD images without stretching", () => {
    expect(fitMealThumbnail(4032, 3024)).toEqual({width:384,height:288});
    expect(fitMealThumbnail(1080,1920)).toEqual({width:216,height:384});
  });
  it("never upscales small photos and enforces a small size budget", () => {
    expect(fitMealThumbnail(200,120)).toEqual({width:200,height:120});
    expect(THUMBNAIL_MAX_EDGE).toBe(384);
    expect(THUMBNAIL_MAX_BYTES).toBeLessThanOrEqual(100 * 1024);
  });
  it("rejects bad dimensions", () => {
    expect(() => fitMealThumbnail(0,100)).toThrow(RangeError);
    expect(() => fitMealThumbnail(Infinity,100)).toThrow(RangeError);
  });
});
