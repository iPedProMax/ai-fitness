import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderToStaticMarkup,
} from "react-dom/server";

import {
  ClarificationCard,
} from "../components/clarification-card";

import {
  foodAnalysisPrompt,
} from "./food-analysis-prompt";

describe(
  "custom clarification flow",
  () => {
    it("offers a typed answer when custom answers are allowed", () => {
      const markup =
        renderToStaticMarkup(
          <ClarificationCard
            clarification={
              {
                id: "sugar_amount",
                foodIndex: 0,
                question:
                  "How much sugar did you add?",
                options: [
                  "1 tsp",
                  "2 tsp",
                  "1 tbsp",
                  "Not sure",
                ],
                allowCustomAnswer:
                  true,
              } as any
            }
            selectedAnswer={
              null
            }
            disabled={false}
            onSelect={() => {}}
          />
        );

      expect(
        markup
      ).toContain(
        "Other / type it"
      );
    });

    it("teaches Gemini to ask quantity questions when amount matters", () => {
      expect(
        foodAnalysisPrompt
      ).toContain(
        "allowCustomAnswer"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "quantity"
      );

      expect(
        foodAnalysisPrompt
      ).toContain(
        "How much sugar did you add?"
      );
    });
  }
);