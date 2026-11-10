import { describe, expect, it } from "vitest";
import { classifyTextAiFailure } from "./text-failure";

describe("Q4.11B Text AI safe failure diagnostics (no network or credits)", () => {
  it("distinguishes upstream rate limits without exposing responses", () => {
    const result = classifyTextAiFailure(Object.assign(new Error("SECRET UPSTREAM RESPONSE"), { status: 429 }));
    expect(result).toMatchObject({ category: "UPSTREAM_HTTP", code: "AI_TEXT_UPSTREAM_REJECTED", upstreamStatus: 429 });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("classifies rejected upstream requests without leaking secrets", () => {
    expect(classifyTextAiFailure({ statusCode: 502, body: "PRIVATE PROVIDER BODY" }))
      .toMatchObject({ category: "UPSTREAM_HTTP", upstreamStatus: 502 });
    expect(JSON.stringify(classifyTextAiFailure({ statusCode: 502, body: "PRIVATE PROVIDER BODY" })))
      .not.toContain("PRIVATE");
  });
  it("distinguishes truncated provider responses", () => {
    expect(classifyTextAiFailure(new Error("Text provider output incomplete")))
      .toMatchObject({ category: "OUTPUT_INCOMPLETE", code: "AI_TEXT_INCOMPLETE" });
  });
  it("distinguishes invalid JSON from invalid schema", () => {
    expect(classifyTextAiFailure(new SyntaxError("bad private token")))
      .toMatchObject({ category: "OUTPUT_INVALID_JSON" });
    expect(classifyTextAiFailure({ name: "ZodError", issues: [{ message: "PRIVATE" }] }))
      .toMatchObject({ category: "OUTPUT_INVALID_SCHEMA" });
  });
  it("falls back safely and never treats text as a recognized failure type", () => {
    const result = classifyTextAiFailure("SECRET USER PROMPT");
    expect(result).toMatchObject({ category: "UNEXPECTED_FAILURE", upstreamStatus: null });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});