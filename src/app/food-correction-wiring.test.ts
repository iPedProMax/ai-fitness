import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("food correction wiring", () => {
  it("applies corrections to the same analysis object used by AddMealButton", () => {
    const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain("<FoodCorrectionPanel analysis={analysis} onApply={setAnalysis} />");
    expect(page).toContain("<AddMealButton analysis={analysis} />");
  });
});
