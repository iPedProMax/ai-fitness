import { describe, expect, it } from "vitest";
import { centimetersToFeetInches, feetInchesToCentimeters } from "./height-units";

describe("TDEE height unit conversion", () => {
  it("converts 5 ft 4 in to about 162.6 cm", () => {
    expect(feetInchesToCentimeters(5, 4)).toBe(162.6);
  });
  it("converts 5 ft 5 in to about 165.1 cm", () => {
    expect(feetInchesToCentimeters(5, 5)).toBe(165.1);
  });
  it("converts 6 ft 0 in to about 182.9 cm", () => {
    expect(feetInchesToCentimeters(6, 0)).toBe(182.9);
  });
  it("converts centimetres into feet and inches for switching units", () => {
    expect(centimetersToFeetInches(165.1)).toEqual({ feet: 5, inches: 5 });
    expect(centimetersToFeetInches(162.6)).toEqual({ feet: 5, inches: 4 });
  });
  it("handles inch rounding near the next foot", () => {
    expect(centimetersToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });
  it("rejects negative inches, 12 or more inches, and partial feet", () => {
    expect(() => feetInchesToCentimeters(5, 12)).toThrow();
    expect(() => feetInchesToCentimeters(5, -1)).toThrow();
    expect(() => feetInchesToCentimeters(5.5, 4)).toThrow();
  });
  it("rejects missing or invalid centimetre values", () => {
    expect(() => centimetersToFeetInches(0)).toThrow();
    expect(() => centimetersToFeetInches(Number.NaN)).toThrow();
  });
});
