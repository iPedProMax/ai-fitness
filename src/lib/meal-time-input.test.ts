import { readFileSync } from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  localDateString,
  localMealTimeToIso,
} from "./meal-time-input";

describe("meal-time input", () => {
  it("converts local eating time to UTC ISO", () => {
    const expected = new Date(
      2026, 9, 9, 19, 30
    ).toISOString();

    const result = localMealTimeToIso(
      "2026-10-09",
      "19:30",
      new Date(2026, 9, 10, 12)
    );

    expect(result).toBe(expected);
  });

  it("rejects nonexistent dates", () => {
    expect(
      localMealTimeToIso(
        "2026-02-30",
        "12:00"
      )
    ).toBeNull();
  });

  it("requires an explicitly selected time", () => {
    expect(
      localMealTimeToIso(
        "2026-10-09",
        ""
      )
    ).toBeNull();
  });

  it("rejects future eating times", () => {
    expect(
      localMealTimeToIso(
        "2026-10-11",
        "19:00",
        new Date(2026, 9, 10, 12)
      )
    ).toBeNull();
  });

  it("formats local calendar dates correctly", () => {
    expect(
      localDateString(
        new Date(2026, 9, 9, 12)
      )
    ).toBe("2026-10-09");
  });

  it("connects eating time to Add Meal", () => {
    const source = readFileSync(
      new URL(
        "../components/add-meal-button.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain(
      "localMealTimeToIso("
    );

    expect(source).toContain(
      "saveMeal(analysis, consumedAt)"
    );

    expect(source).toContain(
      "Save your meal"
    );

    expect(source).toContain(
      "Choose another date or time"
    );

    expect(source).toContain(
      "Confirm & Save"
    );
  });
});