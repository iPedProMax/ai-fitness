import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

describe(
  "food scanner guidance",
  () => {
    it("recommends scanning 1-3 foods while keeping the 6 photo limit", () => {
      const source =
        readFileSync(
          join(
            process.cwd(),
            "src/app/page.tsx"
          ),
          "utf8"
        );

      expect(
        source
      ).toContain(
        "For best results, scan 1-3 foods or drinks at a time."
      );

      expect(
        source
      ).toContain(
        "Add up to 6 photos, including labels, packaging, and scale photos."
      );
    });
  }
);