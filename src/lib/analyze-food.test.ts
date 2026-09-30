import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { analyzeFood } from "./analyze-food";

const expectedResult = {
  foods: [
    {
      name: "Rolled oats",
      estimatedGrams: 70.6,
      calories: 272,
      protein: 11.8,
      carbs: 46.5,
      fat: 4.9,
      confidence: 0.95,
      weightSource:
        "SCALE_MEASURED" as const,
      nutritionSource:
        "AI_ESTIMATE" as const,
    },
  ],
  totalCalories: 272,
  notes: "Food analysed.",
  clarifications: [],
};

describe("analyzeFood", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an image stack to the analysis API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            expectedResult
          ),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        )
      );

    const firstImage =
      new File(
        ["food"],
        "food.jpg",
        {
          type: "image/jpeg",
        }
      );

    const secondImage =
      new File(
        ["label"],
        "label.jpg",
        {
          type: "image/jpeg",
        }
      );

    const result =
      await analyzeFood({
        images: [
          firstImage,
          secondImage,
        ],
      });

    const options =
      fetchMock.mock.calls[0][1];

    const formData =
      options?.body as FormData;

    expect(
      formData.getAll("images")
    ).toEqual([
      firstImage,
      secondImage,
    ]);

    expect(result).toEqual(
      expectedResult
    );
  });

  it("allows a single image", async () => {
    vi.spyOn(
      globalThis,
      "fetch"
    ).mockResolvedValue(
      new Response(
        JSON.stringify(
          expectedResult
        ),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      )
    );

    const image = new File(
      ["food"],
      "food.jpg",
      {
        type: "image/jpeg",
      }
    );

    await expect(
      analyzeFood({
        images: [image],
      })
    ).resolves.toEqual(
      expectedResult
    );
  });

  it("rejects an empty image stack", async () => {
    await expect(
      analyzeFood({
        images: [],
      })
    ).rejects.toThrow(
      "At least one image is required."
    );
  });

  it("rejects more than six images", async () => {
    const images =
      Array.from(
        { length: 7 },
        (_, index) =>
          new File(
            ["image"],
            `image-${index}.jpg`,
            {
              type: "image/jpeg",
            }
          )
      );

    await expect(
      analyzeFood({
        images,
      })
    ).rejects.toThrow(
      "You can analyze up to 6 images at a time."
    );
  });
});