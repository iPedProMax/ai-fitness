import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MealHistoryThumbnail } from "./meal-history-thumbnail";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/meals/page.tsx"), "utf8");
const component = readFileSync(join(root, "src/components/meal-history-thumbnail.tsx"), "utf8");
const addButton = readFileSync(join(root, "src/components/add-meal-button.tsx"), "utf8");

describe("Q4.16A Meal History image header and default Save photo", () => {
  it("uses the saved signed photo in the collapsed row and removes duplicated expanded photo", () => {
    expect(page).toContain("<MealHistoryThumbnail");
    expect(page).toContain("src={meal.thumbnail_path ? photoUrls.get(meal.thumbnail_path) : undefined}");
    expect(page).toContain('createSignedUrls(photoPaths, 1800)');
    expect(page).not.toContain('alt="Saved food photo"');
  });

  it("uses a clickable photo only when a signed thumbnail exists", () => {
    const photo = renderToStaticMarkup(<MealHistoryThumbnail src="https://example.test/private-signed-thumb.webp" foodName="Pancit" emoji="🍜" />);
    expect(photo).toContain("Enlarge saved photo: Pancit");
    expect(photo).toContain("private-signed-thumb.webp");
    expect(photo).not.toContain("🍜");
    const fallback = renderToStaticMarkup(<MealHistoryThumbnail foodName="Pancit" emoji="🍜" />);
    expect(fallback).toContain("🍜");
    expect(fallback).not.toContain("Enlarge saved photo");
  });

  it("keeps the photo preview keyboard-friendly and doesn't toggle the meal details", () => {
    expect(component).toContain('event.preventDefault()');
    expect(component).toContain('event.stopPropagation()');
    expect(component).toContain('event.key === "Escape"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('aria-label="Close meal photo preview"');
  });

  it("defaults photo saving on only when a photo is supplied, allowing the user to opt out", () => {
    expect(addButton).toContain('useState(photoFiles.length > 0)');
    expect(addButton).toContain('setSavePhoto(photoFiles.length > 0)');
    expect(addButton).toContain('checked={savePhoto}');
    expect(addButton).toContain('setSavePhoto(event.target.checked)');
    expect(addButton).toContain('if (savePhoto && selectedPhoto)');
  });
});
