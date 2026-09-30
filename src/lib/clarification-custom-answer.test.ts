import {
  describe,
  expect,
  it,
} from "vitest";

import {
  foodAnalysisSchema,
} from "./food-analysis";

describe(
  "custom clarification answers",
  () => {
    it("preserves whether a clarification allows a typed answer", () => {
      const result =
        foodAnalysisSchema.parse({
          foods: [],
          totalCalories: 0,
          notes: "",
          clarifications: [
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
            },
          ],
        });

      expect(
        result.clarifications[0]
          .allowCustomAnswer
      ).toBe(true);
    });
  }
);