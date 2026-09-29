import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("POST /api/food/analyze prompt", () => {
    beforeEach(() => {
        createMock.mockReset();
        process.env.GEMINI_API_KEY = "test-key";
    });

    it("sends clarification instructions to Gemini", async () => {
        createMock.mockResolvedValue({
            output_text: JSON.stringify({
                foods: [],
                totalCalories: 0,
                notes: "",
                clarifications: [],
            }),
        });

        const formData = new FormData();

        formData.append(
            "image",
            new File(["fake image"], "food.jpg", {
                type: "image/jpeg",
            })
        );

        const request = new Request(
            "http://localhost:3000/api/food/analyze",
            {
                method: "POST",
                body: formData,
            }
        );

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledTimes(1);

        const config = createMock.mock.calls[0][0] as {
            input: Array<{
                type: string;
                text?: string;
            }>;
        };

        expect(config.input[0].text).toContain("clarifications");
        expect(config.input[0].text).toContain("Do not guess");
    });
});