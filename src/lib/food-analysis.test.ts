import { describe, expect, it } from "vitest";
import {
    foodAnalysisJsonSchema,
    foodAnalysisSchema,
} from "./food-analysis";

describe("foodAnalysisSchema", () => {
    it("accepts a valid food analysis", () => {
        const result = foodAnalysisSchema.parse({
            foods: [
                {
                    name: "White rice",
                    estimatedGrams: 180,
                    calories: 234,
                    protein: 4.3,
                    carbs: 51,
                    fat: 0.5,
                    confidence: 0.9,
                },
            ],
            totalCalories: 234,
            notes: "Portion visually estimated.",
        });

        expect(result.foods[0].name).toBe("White rice");
        expect(result.totalCalories).toBe(234);
    });

    it("rejects negative calories", () => {
        expect(() =>
            foodAnalysisSchema.parse({
                foods: [
                    {
                        name: "Rice",
                        estimatedGrams: 100,
                        calories: -200,
                        protein: 2,
                        carbs: 30,
                        fat: 0,
                        confidence: 0.8,
                    },
                ],
                totalCalories: -200,
                notes: "",
            })
        ).toThrow();
    });
    it("keeps clarification questions for uncertain ingredients", () => {
        const result = foodAnalysisSchema.parse({
            foods: [
                {
                    name: "Pancit Bihon",
                    estimatedGrams: 250,
                    calories: 370,
                    protein: 12,
                    carbs: 55,
                    fat: 11,
                    confidence: 0.7,
                },
            ],
            totalCalories: 370,
            notes: "Protein type is unclear from the photo.",
            clarifications: [
                {
                    id: "protein-type",
                    foodIndex: 0,
                    question: "What protein is in this meal?",
                    options: [
                        "Chicken",
                        "Beef",
                        "Pork",
                        "Shrimp",
                        "None",
                        "Not sure",
                    ],
                },
            ],
        });

        expect(result.clarifications).toHaveLength(1);
        expect(result.clarifications[0].question).toBe(
            "What protein is in this meal?"
        );
    });
    it("includes clarifications in the Gemini JSON schema", () => {
        expect(foodAnalysisJsonSchema).toMatchObject({
            properties: {
                clarifications: {
                    type: "array",
                },
            },
        });
    });
});