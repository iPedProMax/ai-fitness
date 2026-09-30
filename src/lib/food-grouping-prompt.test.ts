import {
  describe,
  expect,
  it,
} from "vitest";

import {
  foodAnalysisPrompt,
} from "./food-analysis-prompt";

describe(
  "food grouping prompt",
  () => {
    it("teaches Gemini to group components into composed dishes or drinks", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "COMPOSED ITEM GROUPING"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "Determine whether visible components form one composed dish or drink"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "Do not automatically return every visible ingredient as a separate food item"
      );
    });

    it("keeps genuinely separate foods as separate items", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "separately consumed"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "If grouping is uncertain and could materially change calories"
      );
    });
  }
);