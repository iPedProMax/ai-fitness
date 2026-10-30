/** Validate uploaded barcode photos before attempting local decoding. */
export const MAX_BARCODE_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function validateBarcodeImageFile(file: Pick<File,"size"|"type">): string|null {
  if(!ACCEPTED_TYPES.has(file.type))return "Choose a JPG, PNG or WEBP barcode image.";
  if(!Number.isFinite(file.size)||file.size <= 0)return "The selected image is empty or invalid.";
  if(file.size > MAX_BARCODE_IMAGE_BYTES)return "The barcode photo must be 10 MB or smaller.";
  return null;
}
