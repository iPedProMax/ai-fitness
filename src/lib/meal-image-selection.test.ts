import { describe, expect, it } from "vitest";
import {
  MAX_MEAL_IMAGES,
  MAX_MEAL_IMAGE_BYTES,
  selectMealImages,
} from "./meal-image-selection";

function photo(name: string, mimeType = "image/jpeg", bytes = 4, modified = 1) {
  return new File([new Uint8Array(bytes)], name, {
    type: mimeType,
    lastModified: modified,
  });
}

describe("meal photo selection", () => {
  it("accepts supported photo formats without changing the original list", () => {
    const existing = [photo("rice.jpg")];
    const result = selectMealImages(existing, [
      photo("label.png", "image/png"),
      photo("package.webp", "image/webp"),
    ]);
    expect(existing).toHaveLength(1);
    expect(result.images.map(file => file.name)).toEqual([
      "rice.jpg", "label.png", "package.webp",
    ]);
    expect(result.added).toBe(2);
    expect(result.notice).toBeNull();
  });

  it("ignores already uploaded photos and repeats within one selection", () => {
    const rice = photo("rice.jpg");
    const label = photo("label.png", "image/png");
    const result = selectMealImages([rice], [rice, label, label]);
    expect(result.images).toEqual([rice, label]);
    expect(result.added).toBe(1);
    expect(result.notice).toContain("Duplicate photos");
  });

  it("does not assume same-name images are duplicates if their metadata differs", () => {
    const result = selectMealImages([photo("plate.jpg", "image/jpeg", 4, 1)], [
      photo("plate.jpg", "image/jpeg", 4, 2),
    ]);
    expect(result.added).toBe(1);
  });

  it("rejects unsupported file types before attempting upload", () => {
    const result = selectMealImages([], [photo("menu.gif", "image/gif")]);
    expect(result.added).toBe(0);
    expect(result.images).toEqual([]);
    expect(result.notice).toMatch(/JPG, PNG and WEBP/);
  });

  it("rejects empty files", () => {
    const result = selectMealImages([], [photo("empty.jpg", "image/jpeg", 0)]);
    expect(result.images).toHaveLength(0);
    expect(result.notice).toContain("Empty photo");
  });

  it("rejects photos exceeding the backend's 10 MB limit", () => {
    const result = selectMealImages([], [photo("huge.jpg", "image/jpeg", MAX_MEAL_IMAGE_BYTES + 1)]);
    expect(result.images).toHaveLength(0);
    expect(result.notice).toContain("10 MB");
  });

  it("accepts an image exactly at the allowed 10 MB boundary", () => {
    const result = selectMealImages([], [photo("limit.jpg", "image/jpeg", MAX_MEAL_IMAGE_BYTES)]);
    expect(result.added).toBe(1);
    expect(result.notice).toBeNull();
  });

  it("caps a batch at ten photos and explains that extra photos were skipped", () => {
    const photos = Array.from({ length: MAX_MEAL_IMAGES + 2 }, (_, i) => photo(`photo-${i}.jpg`));
    const result = selectMealImages([], photos);
    expect(result.images).toHaveLength(MAX_MEAL_IMAGES);
    expect(result.added).toBe(MAX_MEAL_IMAGES);
    expect(result.notice).toContain("up to 10 photos");
  });

  it("retains existing photos when there is no room for more", () => {
    const existing = Array.from({ length: MAX_MEAL_IMAGES }, (_, i) => photo(`photo-${i}.jpg`));
    const result = selectMealImages(existing, [photo("extra.jpg")]);
    expect(result.images).toEqual(existing);
    expect(result.added).toBe(0);
    expect(result.notice).toContain("up to 10 photos");
  });

  it("reports multiple rejection reasons while preserving valid uploads", () => {
    const result = selectMealImages([], [
      photo("wrong.svg", "image/svg+xml"),
      photo("valid.jpg"),
      photo("same.jpg"),
      photo("same.jpg"),
      photo("bad-size.jpg", "image/jpeg", MAX_MEAL_IMAGE_BYTES + 1),
    ]);
    expect(result.images.map(file => file.name)).toEqual(["valid.jpg", "same.jpg"]);
    expect(result.added).toBe(2);
    expect(result.notice).toContain("JPG, PNG and WEBP");
    expect(result.notice).toContain("10 MB");
    expect(result.notice).toContain("Duplicate photos");
  });
});
