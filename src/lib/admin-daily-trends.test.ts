import { describe, expect, it } from "vitest";
import { countByManilaDay, lastSevenManilaDays, manilaDateKey } from "./admin-daily-trends";

describe("Y1 private admin aggregate date handling", () => {
  it("uses Philippine calendar days across UTC boundaries", () => {
    expect(manilaDateKey("2026-11-01T16:30:00.000Z")).toBe("2026-11-02");
    expect(manilaDateKey("2026-11-01T15:30:00.000Z")).toBe("2026-11-01");
    expect(manilaDateKey("bad-date")).toBeNull();
  });
  it("gives exactly seven Philippine dates even at month changes", () => {
    expect(lastSevenManilaDays(new Date("2026-11-02T12:00:00Z"))).toEqual([
      "2026-10-27","2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01","2026-11-02",
    ]);
  });
  it("counts only recorded events; never equates no log with no activity", () => {
    expect(countByManilaDay(["2026-11-01T16:30:00Z", "2026-11-01T18:30:00Z", "bad"], ["2026-11-01", "2026-11-02"])).toEqual([0,2]);
  });
});
