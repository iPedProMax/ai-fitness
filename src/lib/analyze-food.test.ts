import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFood } from "./analyze-food";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("analyzeFood", () => {
    it("sends the selected image to the food analysis API", async () => {
        const image = new File(["fake image"], "food.jpg", {
            type: "image/jpeg",
        });

        const expectedResult = {
            foods: [
                {
                    name: "Pancit Bihon",
                    estimatedGrams: 250,
                    calories: 370,
                    protein: 12,
                    carbs: 55,
                    fat: 11,
                    confidence: 0.8,
                },
            ],
            totalCalories: 370,
            notes: "Portion visually estimated.",
            clarifications: [],
        };

        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(expectedResult), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            })
        );

        vi.stubGlobal("fetch", fetchMock);

        const result = await analyzeFood(image);

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0] as [
            string,
            RequestInit,
        ];

        expect(url).toBe("/api/food/analyze");
        expect(options.method).toBe("POST");
        expect(options.body).toBeInstanceOf(FormData);

        const formData = options.body as FormData;

        expect(formData.get("image")).toBe(image);
        expect(result).toEqual(expectedResult);
    });
});