import { submitAiRequest, type AiSubmissionOptions } from "./ai-submission";
import {
  foodAnalysisSchema,
  type FoodAnalysis,
} from "./food-analysis";

export type FoodAnalysisInput = {
  images: File[];
};

const MAX_IMAGES = 10;

export async function analyzeFood(
  input: File | File[] | FoodAnalysisInput,
  options?: AiSubmissionOptions
): Promise<FoodAnalysis> {
  const images =
    input instanceof File
      ? [input]
      : Array.isArray(input)
        ? input
        : input.images;

  if (images.length === 0) {
    throw new Error(
      "At least one image is required."
    );
  }

  if (images.length > MAX_IMAGES) {
    throw new Error(
      `You can analyze up to ${MAX_IMAGES} images at a time.`
    );
  }

  const formData = new FormData();

  images.forEach((image) => {
    formData.append("images", image);
  });

  const response = await submitAiRequest(
    "/api/food/analyze",
    {
      method: "POST",
      body: formData,
    }, options
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ??
        "Food analysis failed."
    );
  }

  return foodAnalysisSchema.parse(
    data
  );
}
