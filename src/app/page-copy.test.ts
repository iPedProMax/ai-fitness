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
    it("recommends scanning 1-3 foods while adapting to the selected AI provider", () => {
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
        "Add up to ${MAX_IMAGES} photo"
      );
      expect(source).toContain("selectMealImages(images, incoming, MAX_IMAGES)");
      expect(source).toContain("disabled={MAX_IMAGES === 0}");
      expect(source).toContain("overProviderLimit");
    });
  }
);