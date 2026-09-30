import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isValidClarificationAnswer,
} from "./clarification-answer";

describe(
  "isValidClarificationAnswer",
  () => {
    it("accepts arbitrary text when custom answers are allowed", () => {
      expect(
        isValidClarificationAnswer(
          {
            options: [
              "Nothing",
              "Sugar",
              "Honey",
              "Other",
            ],
            allowCustomAnswer:
              true,
          },
          "some apple slice, honey about 3 table spoon, lemonade"
        )
      ).toBe(true);
    });

    it("still rejects arbitrary text when custom answers are not allowed", () => {
      expect(
        isValidClarificationAnswer(
          {
            options: [
              "Yes",
              "No",
              "Not sure",
            ],
            allowCustomAnswer:
              false,
          },
          "random answer"
        )
      ).toBe(false);
    });
  }
);