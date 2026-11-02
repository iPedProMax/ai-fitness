import { describe, expect, it } from "vitest";
import { BEGINNER_TOUR_EVENT, beginnerTourSteps, beginnerTourStorageKey, spotlightCardPosition, spotlightHole } from "./beginner-tour";

describe("Phase U11 beginner tutorial", () => {
  it("guides users through actual log, coach, reports, activities and settings pages", () => {
    expect(beginnerTourSteps.map(step => step.id)).toEqual(["photo", "manual", "coach-nav", "coach-floating", "coach", "reports", "activities", "settings"]);
    expect(beginnerTourSteps.map(step => step.path)).toEqual(["/", "/", "/", "/", "/coach", "/reports", "/activities", "/settings"]);
    expect(beginnerTourSteps.every(step => step.selector && step.title && step.description)).toBe(true);
    expect(BEGINNER_TOUR_EVENT).toBe("khalories:tour:replay");
  });
  it("keeps completion or skip state isolated to the current signed-in user", () => {
    const a = beginnerTourStorageKey("e4b67f18-1234-4b50-a681-afe010123456");
    const b = beginnerTourStorageKey("e4b67f18-1234-4b50-a681-afe010123457");
    expect(a).not.toBe(b);
    expect(a).toContain("v1:");
    expect(() => beginnerTourStorageKey("a@example.com")).toThrow();
  });
  it("clamps spotlight to viewport so no negative overlay sizes appear", () => {
    expect(spotlightHole({ left: -10, top: -6, right: 80, bottom: 32 }, 320, 600)).toEqual({ left: 0, top: 0, right: 88, bottom: 40 });
    expect(spotlightHole({ left: 300, top: 550, right: 500, bottom: 700 }, 320, 600)).toEqual({ left: 292, top: 542, right: 320, bottom: 600 });
  });
  it("places a spotlight tip below when space is available and above otherwise", () => {
    const below = spotlightCardPosition({ left: 50, right: 200, top: 60, bottom: 110 }, 1000, 800);
    const above = spotlightCardPosition({ left: 50, right: 200, top: 600, bottom: 650 }, 1000, 800);
    expect(below.arrow).toBe("up");
    expect(above.arrow).toBe("down");
    expect(below.top).toBeGreaterThan(110);
    expect(above.top).toBeLessThan(600);
  });
  it("centers tour content on narrow screens", () => {
    const pos = spotlightCardPosition({ left: 50, right: 180, top: 80, bottom: 140 }, 375, 667);
    expect(pos.arrow).toBe("none");
    expect(pos.left).toBeGreaterThanOrEqual(16);
    expect(pos.width).toBeLessThanOrEqual(375 - 32);
  });
});