import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("scanner food description wiring", () => {
  it("has an optional editable description field wired into the photo request", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain('id="photo-food-description"');
    expect(page).toContain("description: photoDescription");
    expect(page).toContain("maxLength={400}");
    const client = readFileSync("src/lib/analyze-food.ts", "utf8");
    expect(client).toContain('formData.append("description", description)');
  });
});
