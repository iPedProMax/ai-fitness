import {
    foodAnalysisSchema,
    type FoodAnalysis,
} from "./food-analysis";

export async function analyzeFood(
    image: File
): Promise<FoodAnalysis> {
    const formData = new FormData();

    formData.append("image", image);

    const response = await fetch(
        "/api/food/analyze",
        {
            method: "POST",
            body: formData,
        }
    );

    const data = await response.json();

    return foodAnalysisSchema.parse(data);
}