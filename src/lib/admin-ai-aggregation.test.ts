import { describe, expect, it } from "vitest";
import { aggregateDailyCredits, aggregateProviderWindows, summarizeRequestOutcomes } from "./admin-ai-aggregation";

const days = ["2026-10-31", "2026-11-01", "2026-11-02"];
describe("Y2 admin AI operations aggregation", () => {
  it("sums multiple users without exposing any individual user data", () => {
    expect(aggregateDailyCredits([
      { usage_date: "2026-11-02", analyses_used: 2, refinements_used: 3 },
      { usage_date: "2026-11-02", analyses_used: 4, refinements_used: 1 },
      { usage_date: "2026-11-01", analyses_used: 0, refinements_used: 2 },
    ], days)).toEqual([
      { day: "2026-10-31", analyses: 0, refinements: 0 },
      { day: "2026-11-01", analyses: 0, refinements: 2 },
      { day: "2026-11-02", analyses: 6, refinements: 4 },
    ]);
  });
  it("rejects invalid or missing daily counters instead of inventing zero", () => {
    expect(aggregateDailyCredits([{ usage_date: "2026-11-02", analyses_used: null, refinements_used: 0 }], days)).toBeNull();
    expect(aggregateDailyCredits([{ usage_date: "2026-11-02", analyses_used: -1, refinements_used: 0 }], days)).toBeNull();
  });
  it("sums provider attempt windows, including bigint-like integers", () => {
    expect(aggregateProviderWindows([
      { provider: "gemini", requests: "2", tokens: "1200" },
      { provider: "gemini", requests: 3, tokens: 300 },
      { provider: "groq", requests: 1, tokens: 0 },
    ])).toEqual([
      { provider: "gemini", requests: 5, tokens: 1500 },
      { provider: "groq", requests: 1, tokens: 0 },
    ]);
  });
  it("never treats null or malformed token accounting as zero", () => {
    expect(aggregateProviderWindows([{ provider: "gemini", requests: 1, tokens: null }])).toBeNull();
    expect(aggregateProviderWindows([{ provider: "gemini", requests: 1, tokens: Number.MAX_SAFE_INTEGER + 1 }])).toBeNull();
  });
  it("counts only completed error responses, preserving running requests", () => {
    expect(summarizeRequestOutcomes([
      { state: "complete", response_status: 200 },
      { state: "complete", response_status: 429 },
      { state: "complete", response_status: 504 },
      { state: "running", response_status: null },
    ])).toEqual({ completed: 3, errors: 2, timeouts: 1, running: 1 });
  });
  it("flags invalid state or status instead of counting an error", () => {
    expect(summarizeRequestOutcomes([{ state: "complete", response_status: 999 }])).toBeNull();
    expect(summarizeRequestOutcomes([{ state: "unknown", response_status: 200 }])).toBeNull();
  });
});
