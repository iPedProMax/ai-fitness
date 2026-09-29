import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ClarificationCard } from "./clarification-card";

describe("ClarificationCard", () => {
  it("shows the clarification question and answer options", () => {
    const html = renderToStaticMarkup(
      <ClarificationCard
        clarification={{
          id: "meat-type",
          foodIndex: 0,
          question: "What type of meat is in the noodles?",
          options: [
            "Chicken",
            "Beef",
            "Pork",
            "Shrimp",
            "Not sure",
          ],
        }}
        selectedAnswer={null}
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain(
      "What type of meat is in the noodles?"
    );

    expect(html).toContain("Chicken");
    expect(html).toContain("Beef");
    expect(html).toContain("Pork");
    expect(html).toContain("Shrimp");
    expect(html).toContain("Not sure");
  });
});