import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

const { createMock } = vi.hoisted(() => ({
    createMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
    GoogleGenAI: class {
        interactions = {
            create: createMock,
        };
    },
}));

import { POST } from "./route";

describe("POST /api/food/refine", () => {
    beforeEach(() => {
        createMock.mockReset();

        process.env.GEMINI_API_KEY =
            "test-key";
    });

    it("refines food using the confirmed clarification answer", async () => {
        createMock.mockResolvedValue({
            output_text: JSON.stringify({
                foods: [
                    {
                        name: "Chicken Pancit",
                        estimatedGrams: 250,
                        calories: 365,
                        protein: 15,
                        carbs: 55,
                        fat: 10,
                        confidence: 0.85,
                    },
                ],
                totalCalories: 365,
                notes:
                    "Chicken was confirmed by the user.",
                clarifications: [],
            }),
        });

        const request = new Request(
            "http://localhost:3000/api/food/refine",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json",
                },
                body: JSON.stringify({
                    analysis: {
                        foods: [
                            {
                                name:
                                    "Pancit with mixed meat",
                                estimatedGrams: 250,
                                calories: 380,
                                protein: 10,
                                carbs: 55,
                                fat: 13,
                                confidence: 0.75,
                            },
                        ],
                        totalCalories: 380,
                        notes:
                            "Meat type uncertain.",
                        clarifications: [
                            {
                                id: "meat_type",
                                foodIndex: 0,
                                question:
                                    "What type of meat is included?",
                                options: [
                                    "Chicken",
                                    "Pork",
                                    "Beef",
                                ],
                            },
                        ],
                    },

                    clarificationId:
                        "meat_type",

                    answer: "Chicken",
                }),
            }
        );

        const response = await POST(request);

        expect(response.status).toBe(200);

        const result =
            await response.json();

        expect(result.foods[0].name).toBe(
            "Chicken Pancit"
        );

        expect(
            result.clarifications
        ).toEqual([]);

        expect(createMock).toHaveBeenCalledTimes(
            1
        );

        const config = createMock.mock.calls[0][0] as {
            input: Array<{
                type: string;
                text?: string;
            }>;
        };

        expect(config.input[0].text).toContain("Chicken");
        expect(config.input[0].text).toContain("CONFIRMED FACT");
    });

    it("rejects an answer that was not offered by the clarification", async () => {
        const request = new Request(
            "http://localhost:3000/api/food/refine",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json",
                },
                body: JSON.stringify({
                    analysis: {
                        foods: [
                            {
                                name: "Pancit",
                                estimatedGrams: 250,
                                calories: 380,
                                protein: 10,
                                carbs: 55,
                                fat: 13,
                                confidence: 0.75,
                            },
                        ],

                        totalCalories: 380,

                        notes: "",

                        clarifications: [
                            {
                                id: "meat_type",
                                foodIndex: 0,
                                question:
                                    "What meat is this?",
                                options: [
                                    "Chicken",
                                    "Pork",
                                ],
                            },
                        ],
                    },

                    clarificationId:
                        "meat_type",

                    answer: "Turkey",
                }),
            }
        );

        const response = await POST(request);

        expect(response.status).toBe(400);

        expect(createMock).not.toHaveBeenCalled();
    });
});