import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { createMock } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
  }));

vi.mock(
  "@google/genai",
  () => ({
    GoogleGenAI: class {
      interactions = {
        create: createMock,
      };
    },
  })
);

import { POST } from "./route";

describe(
  "POST /api/food/analyze prompt",
  () => {
    beforeEach(() => {
      createMock.mockReset();

      process.env.GEMINI_API_KEY =
        "test-key";

      createMock.mockResolvedValue({
        output_text:
          JSON.stringify({
            foods: [],
            totalCalories: 0,
            notes: "",
            clarifications: [],
          }),
      });
    });

    it("sends stacked images without requiring manual image roles", async () => {
      const formData =
        new FormData();

      formData.append(
        "images",
        new File(
          ["first"],
          "first.jpg",
          {
            type: "image/jpeg",
          }
        )
      );

      formData.append(
        "images",
        new File(
          ["second"],
          "second.jpg",
          {
            type: "image/jpeg",
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
      ).toBe(200);

      expect(
        createMock
      ).toHaveBeenCalledTimes(
        1
      );

      const config =
        createMock.mock
          .calls[0][0] as {
          input: Array<{
            type: string;
            text?: string;
          }>;
        };

      const text =
        config.input
          .filter(
            (part) =>
              part.type ===
              "text"
          )
          .map(
            (part) =>
              part.text ?? ""
          )
          .join("\n");

      expect(text).toContain(
        "NOT manually classified"
      );

      expect(text).toContain(
        "Infer the purpose of each image yourself"
      );

      expect(text).toContain(
        "IMAGE 1 OF 2"
      );

      expect(text).toContain(
        "IMAGE 2 OF 2"
      );

      const imageParts =
        config.input.filter(
          (part) =>
            part.type ===
            "image"
        );

      expect(
        imageParts
      ).toHaveLength(2);
    });

    it("allows a single unclassified image", async () => {
      const formData =
        new FormData();

      formData.append(
        "images",
        new File(
          ["image"],
          "meal.jpg",
          {
            type: "image/jpeg",
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
      ).toBe(200);

      const config =
        createMock.mock
          .calls[0][0] as {
          input: Array<{
            type: string;
            text?: string;
          }>;
        };

      const text =
        config.input
          .filter(
            (part) =>
              part.type ===
              "text"
          )
          .map(
            (part) =>
              part.text ?? ""
          )
          .join("\n");

      expect(text).toContain(
        "The user supplied 1 image."
      );

      expect(text).toContain(
        "IMAGE 1 OF 1"
      );

      expect(text).not.toContain(
        "IMAGE ROLE:"
      );

      const imageParts =
        config.input.filter(
          (part) =>
            part.type ===
            "image"
        );

      expect(
        imageParts
      ).toHaveLength(1);
    });
  }
);