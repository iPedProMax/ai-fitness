import { describe, expect, it } from "vitest";

import { foodAnalysisPrompt } from "./food-analysis-prompt";

describe("foodAnalysisPrompt", () => {
  it("tells Gemini to ask for clarification when important ingredients are uncertain", () => {
    expect(foodAnalysisPrompt).toContain("clarifications");
    expect(foodAnalysisPrompt).toContain("protein");
    expect(foodAnalysisPrompt).toContain("Do not guess");
  });

  it("requires clarification options to be visually plausible", () => {
    expect(foodAnalysisPrompt).toContain(
      "visually plausible"
    );

    expect(foodAnalysisPrompt).toContain(
      "Do not use a generic list of protein choices"
    );
  });

  it("prevents seafood options when meat has already been detected unless visually plausible", () => {
    expect(foodAnalysisPrompt).toContain(
      "Do not include seafood options such as shrimp"
    );
  });

  it("prevents impossible absence options when an ingredient is visibly present", () => {
    expect(foodAnalysisPrompt).toContain(
      'do not offer "No meat" or "Vegetarian"'
    );
  });

  it("allows a not-sure option for unresolved ingredient uncertainty", () => {
    expect(foodAnalysisPrompt).toContain(
      'Include "Not sure"'
    );
  });
});