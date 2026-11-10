/**
 * Browser-only preparation for Cloudflare Workers AI image uploads.
 * Keeps the selected original photo untouched for display and corrections.
 * Does not run for Gemini or Groq.
 */
export const CLOUDFLARE_IMAGE_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.88;

export function fitCloudflareImage(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Invalid image dimensions.");
  }
  const scale = Math.min(1, CLOUDFLARE_IMAGE_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Best effort: keep the original if the browser cannot safely process it. */
export async function prepareCloudflareImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const fitted = fitCloudflareImage(bitmap.width, bitmap.height);
    const resized = fitted.width < bitmap.width || fitted.height < bitmap.height;
    if (!resized && file.size <= 512 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // A white background avoids converting transparent PNG regions to black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, fitted.width, fitted.height);
    context.drawImage(bitmap, 0, 0, fitted.width, fitted.height);

    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!jpeg || jpeg.size === 0) return file;
    // If dimensions were already acceptable, avoid a larger recompressed file.
    if (!resized && jpeg.size >= file.size) return file;
    const basename = file.name.replace(/\.[^.]+$/, "") || "meal-photo";
    return new File([jpeg], `${basename}-cloudflare.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
