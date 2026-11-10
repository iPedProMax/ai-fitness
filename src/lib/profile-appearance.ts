export type KhaloriesAppearance = "light" | "dark" | "system";
export const APPEARANCE_KEY = "ai-fitness-appearance";
export const PROFILE_UPDATED_EVENT = "khalories-profile-updated";
export const APPEARANCE_UPDATED_EVENT = "khalories-appearance-updated";
export const AVATAR_BUCKET = "khalories-avatars";
export const MAX_AVATAR_INPUT_BYTES = 6 * 1024 * 1024;
export const MAX_AVATAR_OUTPUT_BYTES = 128 * 1024;
export const AVATAR_PIXEL_SIZE = 256;

export const PROFILE_FOCUS = [
  { value: "balanced", label: "Balanced living", emoji: "🌿" },
  { value: "strength", label: "Getting stronger", emoji: "💪" },
  { value: "mindful", label: "Mindful habits", emoji: "✨" },
  { value: "tracking", label: "Just tracking", emoji: "📊" },
] as const;
export type ProfileFocus = typeof PROFILE_FOCUS[number]["value"];

export function normalizeFocus(value: unknown): ProfileFocus {
  return PROFILE_FOCUS.some((item) => item.value === value)
    ? value as ProfileFocus : "balanced";
}

export function validateProfileName(value: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 40) return null;
  return normalized;
}

export function validateProfileBio(value: string): string | null {
  const normalized = value.trim();
  return normalized.length <= 140 && !/[\u0000-\u001f\u007f]/.test(normalized) ? normalized : null;
}

export function safeAvatarPath(userId: string, candidate: unknown): string | null {
  const path = `${userId}/avatar.webp`;
  return typeof candidate === "string" && candidate === path ? path : null;
}

/** Crop and convert in the browser: no source photo or EXIF metadata is uploaded. */
export async function compressAvatar(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error("Choose a photo smaller than 6 MB.");
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("Your browser cannot resize this image. Try a recent Chrome or Edge version.");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Could not read this photo. Try a JPG or PNG instead."); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("The photo dimensions are too large.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PIXEL_SIZE;
    canvas.height = AVATAR_PIXEL_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is not available.");
    const side = Math.min(bitmap.width, bitmap.height);
    const x = Math.floor((bitmap.width - side) / 2);
    const y = Math.floor((bitmap.height - side) / 2);
    context.drawImage(bitmap, x, y, side, side, 0, 0, AVATAR_PIXEL_SIZE, AVATAR_PIXEL_SIZE);
    for (const quality of [0.78, 0.62, 0.46]) {
      const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (result && result.type === "image/webp" && result.size <= MAX_AVATAR_OUTPUT_BYTES) return result;
    }
    throw new Error("Photo couldn't be compressed under 128 KB. Try a simpler image.");
  } finally {
    bitmap.close();
  }
}
