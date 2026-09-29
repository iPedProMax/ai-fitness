import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import {
    foodAnalysisJsonSchema,
    foodAnalysisSchema,
} from "../../../../lib/food-analysis";

import { foodAnalysisPrompt } from "../../../../lib/food-analysis-prompt";

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

        const ai = new GoogleGenAI({
            apiKey,
        });

        const imageBytes = Buffer.from(
            await image.arrayBuffer()
        );

        const base64Image =
            imageBytes.toString("base64");

        const interaction =
            await ai.interactions.create({
                model: "gemini-3.5-flash-lite",

                input: [
                    {
                        type: "text",
                        text: foodAnalysisPrompt,
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

        const result =
            foodAnalysisSchema.parse(parsed);

        return NextResponse.json(result);
    } catch (error) {
        console.error(
            "Gemini food analysis failed:",
            error
        );

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