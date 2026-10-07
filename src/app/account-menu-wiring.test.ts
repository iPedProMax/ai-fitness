import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("account menu", () => {
  it("renders the account menu in the food scanner header", () => {
    const source = readFileSync(
      new URL("./page.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("<AccountMenu />");
  });
});