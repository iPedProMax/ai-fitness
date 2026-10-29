import { describe, expect, it } from "vitest";
import { canSubmitPortionAnswers, findPortionQuestions, makeClarifiedPortionPrompt } from "./portion-clarification";

describe("no-credit local portion clarification", () => {
  it("asks about a dab and records meal vs per-cracker scope", () => {
    const prompt = "2 eggs, SkyFlakes and a dab of ham spread in each cracker";
    const questions = findPortionQuestions(prompt);
    expect(questions.map(q => q.kind)).toEqual(["dab"]);
    const answer = { [questions[0].id]: { amount: "About 1 tsp (5 mL)", scope: "each" as const } };
    expect(makeClarifiedPortionPrompt(prompt, questions, answer)).toContain("per described item");
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
});