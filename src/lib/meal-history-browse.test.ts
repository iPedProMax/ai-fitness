import { describe, expect, it } from "vitest";
import {
  dateBoundaries, groupMealHistory, isCalendarDate, mealHistoryHref,
  parseMealHistoryView, philippinesDay, philippinesDayLabel,
} from "./meal-history-browse";

describe("Z1 meal-history date, search and grouping", () => {
  it("defaults to three logged days and bounds requested pagination", () => {
    expect(parseMealHistoryView({}).days).toBe(3);
    expect(parseMealHistoryView({ days: "6" }).days).toBe(6);
    expect(parseMealHistoryView({ days: "10000" }).days).toBe(3);
    expect(parseMealHistoryView({ days: "99" }).days).toBe(60);
  });
  it("rejects invalid Philippine dates and constrains search length", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-11-02")).toBe(true);
    expect(parseMealHistoryView({ period: "date", date: "2026-02-30" }).date).toBe("");
    expect(parseMealHistoryView({ q: "x".repeat(90) }).term).toHaveLength(80);
  });
  it("groups by Manila eating day even across UTC midnight", () => {
    expect(philippinesDay("2026-11-01T17:30:00Z")).toBe("2026-11-02");
    const groups = groupMealHistory([
      { id: "a", consumed_at: "2026-11-01T17:30:00Z", created_at: "2026-11-02T12:00:00Z", total_calories: 210 },
      { id: "b", consumed_at: "2026-11-02T02:00:00Z", created_at: "2026-11-02T12:00:00Z", total_calories: 390 },
      { id: "c", consumed_at: "2026-10-31T09:00:00Z", created_at: "2026-11-02T12:00:00Z", total_calories: 80 },
    ]);
    expect(groups.map(g => g.day)).toEqual(["2026-11-02", "2026-10-31"]);
    expect(groups[0].calories).toBe(600);
    expect(philippinesDayLabel(groups[0].day)).toContain("Nov");
  });
  it("date filters use midnight +08:00 and inclusive end-day", () => {
    const view = parseMealHistoryView({ period: "date", date: "2026-11-02" });
    expect(dateBoundaries(view)).toEqual({ start: "2026-11-02T00:00:00+08:00", end: "2026-11-03T00:00:00+08:00" });
  });
  it("preserves search when loading more but resets pagination with quick filters", () => {
    const view = parseMealHistoryView({ q: "Pancit", days: "6" });
    expect(mealHistoryHref(view, { days: 9 })).toBe("/meals?q=Pancit&days=9");
    expect(mealHistoryHref(view, { mode: "week", days: 3 })).toBe("/meals?q=Pancit&period=week");
  });
  it("does not trust missing or reversed date ranges", () => {
    const view = parseMealHistoryView({ period: "range", from: "2026-11-03", to: "2026-11-01" });
    expect(dateBoundaries(view)).toEqual({});
  });
});

// Lightweight database mock: a search must query beyond the first three days.
it("finds three logged days and detects older rows without loading full meal details", async () => {
  const { browseMealIds } = await import("./meal-history-browse");
  const rows = [
    { id: "a", consumed_at: "2026-11-02T12:00:00Z", created_at: "2026-11-02T12:00:00Z" },
    { id: "b", consumed_at: "2026-11-01T12:00:00Z", created_at: "2026-11-01T12:00:00Z" },
    { id: "c", consumed_at: "2026-10-31T12:00:00Z", created_at: "2026-10-31T12:00:00Z" },
    { id: "d", consumed_at: "2026-10-30T12:00:00Z", created_at: "2026-10-30T12:00:00Z" },
  ];
  let userCheck = "";
  const query = {
    select: (_columns: string) => query,
    eq: (_name: string, uid: string) => { userCheck = uid; return query; },
    order: () => query,
    range: (start: number, end: number) => ({ data: rows.slice(start, end + 1), error: null }),
  };
  const fake = { from: (table: string) => { expect(table).toBe("meals"); return query; } };
  const result = await browseMealIds(fake as never, "owner-123", parseMealHistoryView({}));
  expect(result.ids).toEqual(["a", "b", "c"]);
  expect(result.hasMore).toBe(true);
  expect(userCheck).toBe("owner-123");
});
