/**
 * Browser-side image checks matching the food-analysis API limits.
 * Reject invalid photos before an upload can be submitted.
 */
export const MAX_MEAL_IMAGES = 10;
export const MAX_MEAL_IMAGE_BYTES = 10 * 1024 * 1024;

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type MealImageSelection = {
  images: File[];
  added: number;
  notice: string | null;
};

function imageIdentity(file: File): string {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

/** Keeps the existing photos and accepts only valid, unique additions. */
export function selectMealImages(
  current: readonly File[],
  incoming: readonly File[],
  maxImages: number = MAX_MEAL_IMAGES,
): MealImageSelection {
  if (!Number.isInteger(maxImages) || maxImages < 0 || maxImages > MAX_MEAL_IMAGES) {
    throw new RangeError("Unsupported provider image limit.");
  }
  const images = [...current];
  const known = new Set(current.map(imageIdentity));
  let added = 0;
  let unsupported = 0;
  let oversized = 0;
  let empty = 0;
  let duplicate = 0;
  let overLimit = 0;

  for (const file of incoming) {
    if (!supportedTypes.has(file.type)) {
      unsupported++;
      continue;
    }
    if (file.size === 0) {
      empty++;
      continue;
    }
    if (file.size > MAX_MEAL_IMAGE_BYTES) {
      oversized++;
      continue;
    }

    const identity = imageIdentity(file);
    if (known.has(identity)) {
      duplicate++;
      continue;
    }
    if (images.length >= maxImages) {
      overLimit++;
      continue;
    }

    images.push(file);
    known.add(identity);
    added++;
  }

  const notices: string[] = [];
  if (unsupported) notices.push("Only JPG, PNG and WEBP photos are supported.");
  if (oversized) notices.push("Each photo must be 10 MB or smaller.");
  if (empty) notices.push("Empty photo files cannot be uploaded.");
  if (duplicate) notices.push("Duplicate photos were skipped.");
  if (overLimit) notices.push(maxImages === 0
    ? "This provider supports text only. Switch to Manual / Text."
    : `You can attach up to ${maxImages} photo${maxImages === 1 ? "" : "s"} per analysis.`);

  return { images, added, notice: notices.length ? notices.join(" ") : null };
}
