import { submitAiRequest, foodApiError, type AiSubmissionOptions } from "./ai-submission";
import {
  foodAnalysisSchema,
  type FoodAnalysis,
} from "./food-analysis";
import { prepareCloudflareImage } from "./ai/image-optimization";

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

  // Optimise Cloudflare uploads only. Keep the original user-selected photo intact.
  const uploadImages = options?.modelId === "cloudflare"
    ? await Promise.all(images.map(prepareCloudflareImage))
    : images;
  uploadImages.forEach((image) => {
    formData.append("images", image);
  });
  if (options?.modelId) formData.append("model", options.modelId);

  const response = await submitAiRequest(
    "/api/food/analyze",
    {
      method: "POST",
      body: formData,
    }, options
  );

  const data = await response.json();

  if (!response.ok) {
    throw foodApiError(data, "Food analysis failed.", response.headers.get("Retry-After"));
  }

  return foodAnalysisSchema.parse(
    data
  );
}
