import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import {
    foodAnalysisJsonSchema,
    foodAnalysisSchema,
} from "../../../../lib/food-analysis";

const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const image = formData.get("image");

        if (!(image instanceof File)) {
            return NextResponse.json(
                {
                    error: "Food image is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!allowedImageTypes.includes(image.type)) {
            return NextResponse.json(
                {
                    error: "Only JPG, PNG and WEBP images are supported.",
                },
                {
                    status: 400,
                }
            );
        }

        if (image.size > MAX_IMAGE_SIZE) {
            return NextResponse.json(
                {
                    error: "Image must be smaller than 10 MB.",
                },
                {
                    status: 400,
                }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    error: "Gemini API key is not configured.",
                },
                {
                    status: 500,
                }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        const imageBytes = Buffer.from(await image.arrayBuffer());
        const base64Image = imageBytes.toString("base64");

        const prompt = `
You are the food analysis component of a calorie tracking application.

Analyze only the food visible in the provided photograph.

Identify every distinct visible food item.

For each food item estimate:
- name
- portion weight in grams
- calories
- protein in grams
- carbohydrates in grams
- fat in grams
- confidence from 0 to 1

Rules:
1. Never pretend visual portion estimates are exact.
2. Do not invent foods that are not visible.
3. Lower confidence when uncertain.
4. Use reasonable nutrition estimates for the estimated portion.
5. totalCalories should approximately equal the sum of item calories.
6. Mention important uncertainty in notes.
7. Mention uncertainty about oil, sauce, cooking method, or hidden ingredients.
8. If the image does not contain food, return an empty foods array.
`;

        const interaction = await ai.interactions.create({
            model: "gemini-3.5-flash-lite",
            input: [
                {
                    type: "text",
                    text: prompt,
                },
                {
                    type: "image",
                    data: base64Image,
                    mime_type: image.type as
                        | "image/jpeg"
                        | "image/png"
                        | "image/webp",
                },
            ],
            response_format: {
                type: "text",
                mime_type: "application/json",
                schema: foodAnalysisJsonSchema,
            },
        });

        const outputText = interaction.output_text;

        if (!outputText) {
            return NextResponse.json(
                {
                    error: "Gemini returned no analysis.",
                },
                {
                    status: 502,
                }
            );
        }

        const parsed = JSON.parse(outputText);
        const result = foodAnalysisSchema.parse(parsed);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Gemini food analysis failed:", error);

        return NextResponse.json(
            {
                error: "Food analysis failed.",
            },
            {
                status: 500,
            }
        );
    }
}