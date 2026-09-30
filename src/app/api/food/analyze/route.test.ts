import {
  describe,
  expect,
  it,
} from "vitest";

import { POST } from "./route";

describe(
  "POST /api/food/analyze",
  () => {
    it("returns 400 when no images are provided", async () => {
      const request =
        new Request(
          "http://localhost:3000/api/food/analyze",
          {
            method: "POST",
            body: new FormData(),
          }
        );

      const response =
        await POST(request);

      expect(
        response.status
      ).toBe(400);

      expect(
        await response.json()
      ).toEqual({
        error:
          "At least one image is required.",
      });
    });

    it("rejects unsupported file types", async () => {
      const formData =
        new FormData();

      formData.append(
        "images",
        new File(
          ["hello"],
          "food.txt",
          {
            type: "text/plain",
          }
        )
      );

      const request =
        new Request(
          "http://localhost:3000/api/food/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      const response =
        await POST(request);

      expect(
        response.status
      ).toBe(400);

      expect(
        await response.json()
      ).toEqual({
        error:
          "Only JPG, PNG and WEBP images are supported.",
      });
    });

    it("rejects images larger than 10 MB", async () => {
      const formData =
        new FormData();

      const image =
        new File(
          [
            new Uint8Array(
              10 * 1024 * 1024 +
                1
            ),
          ],
          "large.jpg",
          {
            type: "image/jpeg",
          }
        );

      formData.append(
        "images",
        image
      );

      const request =
        new Request(
          "http://localhost:3000/api/food/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      const response =
        await POST(request);

      expect(
        response.status
      ).toBe(400);

      expect(
        await response.json()
      ).toEqual({
        error:
          "Each image must be smaller than 10 MB.",
      });
    });

    it("rejects more than six images", async () => {
      const formData =
        new FormData();

      for (
        let index = 0;
        index < 7;
        index += 1
      ) {
        formData.append(
          "images",
          new File(
            ["image"],
            `image-${index}.jpg`,
            {
              type: "image/jpeg",
            }
          )
        );
      }

      const request =
        new Request(
          "http://localhost:3000/api/food/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      const response =
        await POST(request);

      expect(
        response.status
      ).toBe(400);

      expect(
        await response.json()
      ).toEqual({
        error:
          "You can analyze up to 6 images at a time.",
      });
    });
  }
);