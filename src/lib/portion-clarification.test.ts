import { describe, expect, it } from "vitest";
import { canSubmitPortionAnswers, findPortionQuestions, makeClarifiedPortionPrompt } from "./portion-clarification";

describe("no-credit local portion clarification", () => {
  it("asks about a dab and records meal vs per-cracker scope", () => {
    const prompt = "2 eggs, SkyFlakes and a dab of ham spread in each cracker";
    const questions = findPortionQuestions(prompt);
    expect(questions.map(q => q.kind)).toEqual(["dab"]);
    const answer = { [questions[0].id]: { amount: "About 1 tsp (5 mL)", scope: "each" as const, eachCount: "4" } };
    expect(makeClarifiedPortionPrompt(prompt, questions, answer)).toContain("exactly 4 described items");
    expect(makeClarifiedPortionPrompt(prompt, questions, answer)).toContain("in each cracker");
  });
  it("supports multiple independently specified vague quantities", () => {
    const q = findPortionQuestions("one spoonful of peanut butter and a handful of nuts");
    expect(q.map(x => x.kind)).toEqual(["spoonful", "handful"]);
    const answers = Object.fromEntries(q.map(item => [item.id, { amount: "20 g", scope: "total" }])) as Record<string, {amount: string; scope: "total"}>;
    expect(canSubmitPortionAnswers(q, answers)).toBe(true);
    expect(makeClarifiedPortionPrompt("one spoonful of peanut butter and a handful of nuts", q, answers)).toContain("handful: 20 g");
  });
  it("requires scope for non-unknown quantities and accepts an explicit not-sure response", () => {
    const q = findPortionQuestions("a dab of spread");
    expect(canSubmitPortionAnswers(q, {[q[0].id]: { amount: "1 tsp" }})).toBe(false);
    expect(canSubmitPortionAnswers(q, {[q[0].id]: { amount: "UNKNOWN" }})).toBe(true);
    expect(makeClarifiedPortionPrompt("a dab of spread", q, {[q[0].id]: { amount: "UNKNOWN" }})).toContain("quantity unknown");
  });
  it("does not ask for a measured dab or normal non-vague terms", () => {
    expect(findPortionQuestions("a dab (5 g) of ham spread")).toEqual([]);
    expect(findPortionQuestions("1 tbsp olive oil and 2 boiled eggs")).toEqual([]);
    expect(findPortionQuestions("somewhat spicy fish")).toEqual([]);
  });
  it("does not silently truncate an overly long description", () => {
    const text = `${"x".repeat(570)} dab`;
    const q = findPortionQuestions(text);
    expect(() => makeClarifiedPortionPrompt(text, q, {[q[0].id]: { amount: "2 g", scope: "total" }})).toThrow(/600 characters/);
  });
  it("requires a count for each item and rejects a zero, fraction, or absurd count", () => {
    const q = findPortionQuestions("a dab of spread on each cracker");
    const id = q[0].id;
    expect(canSubmitPortionAnswers(q, { [id]: { amount: "1 tsp", scope: "each" } })).toBe(false);
    for (const eachCount of ["0", "1.5", "-1", "101", "many", ""]) {
      expect(canSubmitPortionAnswers(q, { [id]: { amount: "1 tsp", scope: "each", eachCount } })).toBe(false);
    }
    expect(canSubmitPortionAnswers(q, { [id]: { amount: "1 tsp", scope: "each", eachCount: "4" } })).toBe(true);
  });
  it("multiplies a known weight or volume once and never equates volume with weight", () => {
    const description = "a dab of spread on each cracker";
    const q = findPortionQuestions(description);
    const id = q[0].id;
    const volume = makeClarifiedPortionPrompt(description, q, { [id]: { amount: "About 1 tsp (5 mL)", scope: "each", eachCount: "4" } });
    expect(volume).toContain("20 mL across all 4 items");
    expect(volume).not.toContain("20 g");
    const weight = makeClarifiedPortionPrompt(description, q, { [id]: { amount: "3 g", scope: "each", eachCount: "4" } });
    expect(weight).toContain("12 g across all 4 items");
    expect(weight).toContain("do not multiply again");
  });
  it("distinguishes a whole-meal quantity from per-item quantity", () => {
    const description = "a dab of mayonnaise in crackers";
    const q = findPortionQuestions(description);
    const prompt = makeClarifiedPortionPrompt(description, q, { [q[0].id]: { amount: "1 tsp", scope: "total" } });
    expect(prompt).toContain("whole meal (total amount, do not multiply)");
    expect(prompt).not.toContain("exactly 4");
  });
  it("refuses meaningless custom quantities instead of passing guesses to AI", () => {
    const q = findPortionQuestions("a dab of spread");
    const id = q[0].id;
    for (const amount of ["anything", "probably some", "10", "0 g", "10 calories", "1 tsp and a dozen more"]) {
      expect(canSubmitPortionAnswers(q, { [id]: { amount, scope: "total" } })).toBe(false);
    }
    expect(canSubmitPortionAnswers(q, { [id]: { amount: "1/2 tsp", scope: "total" } })).toBe(true);
    expect(canSubmitPortionAnswers(q, { [id]: { amount: "UNKNOWN" } })).toBe(true);
  });
  it("preserves qualitative handfuls without fabricating a gram conversion", () => {
    const text = "a handful of nuts in each bag";
    const q = findPortionQuestions(text);
    const prompt = makeClarifiedPortionPrompt(text, q, { [q[0].id]: { amount: "A small handful", scope: "each", eachCount: "2" } });
    expect(prompt).toContain("each of exactly 2 described items");
    expect(prompt).not.toMatch(/calculated total:/);
  });
});