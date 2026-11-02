/** A meal-history thumbnail is deliberately not a copy of the original upload. */
export const THUMBNAIL_MAX_EDGE = 384;
export const THUMBNAIL_MAX_BYTES = 96 * 1024;

export function fitMealThumbnail(width: number, height: number, maxEdge = THUMBNAIL_MAX_EDGE) {
  if (![width, height, maxEdge].every(Number.isFinite) || width <= 0 || height <= 0 || maxEdge <= 0) {
    throw new RangeError("Invalid meal thumbnail dimensions.");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function webpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
}

/** Browser-only; intentionally FAILS if optimization is unsupported. Never uploads the original. */
export async function makeMealThumbnail(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error("Choose an image under 15 MB for meal history.");
  }
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("This browser can't prepare a private meal thumbnail.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    for (const edge of [384, 320, 256]) {
      const fit = fitMealThumbnail(bitmap.width, bitmap.height, edge);
      const canvas = document.createElement("canvas");
      canvas.width = fit.width;
      canvas.height = fit.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Photo resizing isn't supported in this browser.");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, fit.width, fit.height);
      ctx.drawImage(bitmap, 0, 0, fit.width, fit.height);
      for (const quality of [0.74, 0.60, 0.48]) {
        const blob = await webpBlob(canvas, quality);
        if (!blob || blob.type !== "image/webp") break;
        if (blob.size > 0 && blob.size <= THUMBNAIL_MAX_BYTES) return blob;
      }
    }
    throw new Error("That image couldn't be reduced enough for private storage. Your meal can still be saved.");
  } finally {
    bitmap.close();
  }
}
