import {
  describe,
  expect,
  it,
} from "vitest";

import { foodAnalysisPrompt } from "./food-analysis-prompt";

describe(
  "foodAnalysisPrompt",
  () => {
    it("asks for clarification when important ingredients are uncertain", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "CLARIFICATION RULES"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "Do not guess"
      );
    });

    it("prioritizes nutrition labels over generic AI nutrition estimates", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "Nutrition facts label for nutrition values"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        'nutritionSource = "NUTRITION_LABEL"'
      );
    });

    it("prioritizes scale readings over visual weight estimates", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "Food scale for measured weight"
      );
    });

    it("does not assume a container on a scale was tared", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "DO NOT assume the scale was tared"
      );
    });

    it("requires tare clarification when needed", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "tare_status_"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        '["Yes", "No", "Not sure"]'
      );
    });

    it("requires clarification choices to remain visually plausible", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "visually plausible"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "Do not use a generic list of protein choices"
      );
    });

    it("does not blindly associate a nutrition label with unrelated food", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "Do not force a nutrition label onto an unrelated food"
      );
    });
  }
);