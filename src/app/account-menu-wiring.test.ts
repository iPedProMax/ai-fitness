import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("account menu", () => {
  it("renders the account menu in the shared app shell", () => {
    const shell = readFileSync(
      new URL("../components/app-shell.tsx", import.meta.url),
      "utf8"
    );

    const scanner = readFileSync(
      new URL("./page.tsx", import.meta.url),
      "utf8"
    );

    expect(shell).toContain("<AccountMenu />");
    expect(scanner).not.toContain("<AccountMenu />");
  });
});