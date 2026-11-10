import { describe, expect, it } from "vitest";
import { getClarificationAnswerCopy } from "./clarification-answer-copy";

describe("clarification custom-answer examples", () => {
  it("uses an actual brand example for the oats brand question", () => {
    const copy = getClarificationAnswerCopy({ id: "brand_0", question: "Do you know the brand or exact product of Oats?", options: ["I don't know"] });
    expect(copy.placeholder).toBe("e.g. Quaker Quick Cook Oats");
    expect(copy.helper).toMatch(/brand or full product/i);
    expect(copy.placeholder).not.toMatch(/spoons|10g/i);
  });

  it("uses selectable examples for food variety", () => {
    const copy = getClarificationAnswerCopy({ id: "variety_0", question: "Do you know the type or variety of Oats?", options: ["Rolled oats", "Instant oats", "I don't know"] });
    expect(copy.placeholder).toBe("e.g. Rolled oats or Instant oats");
    expect(copy.helper).toMatch(/variety/i);
  });

  it("uses units for a quantity question", () => {
    const copy = getClarificationAnswerCopy({ id: "sugar_amount", question: "How much sugar did you add?", options: ["Not sure"] });
    expect(copy.placeholder).toMatch(/teaspoons|10 g/i);
    expect(copy.helper).toMatch(/amount and unit/i);
  });

  it("uses ingredient examples when the question is about meat", () => {
    const copy = getClarificationAnswerCopy({ id: "meat-type", question: "What type of meat is in the noodles?", options: ["Chicken", "Pork", "Not sure"] });
    expect(copy.placeholder).toBe("e.g. Chicken or Pork");
  });

  it("uses cooking method examples", () => {
    const copy = getClarificationAnswerCopy({ id: "cooking_method", question: "How was the food prepared?", options: ["Boiled", "Fried", "Not sure"] });
    expect(copy.placeholder).toBe("e.g. Boiled or Fried");
  });

  it("falls back safely for arbitrary AI-generated questions", () => {
    const copy = getClarificationAnswerCopy({ id: "unusual_0", question: "Can you clarify this food?", options: ["Other", "I don't know"] });
    expect(copy.placeholder).toBe("Type your answer here");
    expect(copy.helper).toContain("own words");
  });
});
