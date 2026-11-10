import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
describe("Save Meal photo opt-in", () => {
  it("shows exactly one checkbox inside the confirmation dialog", () => {
    const src = read("./add-meal-button.tsx");
    const form = src.indexOf("<form onSubmit={confirmSave}");
    const checkbox = src.indexOf('id="save-meal-photo"');
    const confirm = src.indexOf("Confirm & Save");
    expect(form).toBeGreaterThanOrEqual(0);
    expect(checkbox).toBeGreaterThan(form);
    expect(confirm).toBeGreaterThan(checkbox);
    expect(src.split('id="save-meal-photo"')).toHaveLength(2);
    expect(src).toContain('type="checkbox"');
    expect(src).not.toContain("Choose which scanned photo to keep");
    expect(src).not.toContain('type="file"');
  });
  it("checks Save photo by default only if a photo exists, and respects an uncheck", () => {
    const src = read("./add-meal-button.tsx");
    expect(src).toContain("const [savePhoto, setSavePhoto] = useState(photoFiles.length > 0)");
    expect(src.slice(src.indexOf("function openConfirmation()"), src.indexOf("async function confirmSave("))).toContain("setSavePhoto(photoFiles.length > 0)");
    expect(src).toContain("checked={savePhoto}");
    expect(src).toContain("setSavePhoto(event.target.checked)");
    expect(src).toContain("if (savePhoto && selectedPhoto)");
    expect(src).toContain("checked by default; uncheck to skip");
  });
  it("stores only the opted-in first photo in the private compressed format", () => {
    const src = read("./add-meal-button.tsx");
    expect(src).toContain("const selectedPhoto = photoFiles[0]");
    expect(src).toContain("if (savePhoto && selectedPhoto)");
    expect(src).toContain("makeMealThumbnail(selectedPhoto)");
    expect(src).toContain('storage.from("meal-thumbnails").upload');
    expect(src).toContain('thumbnail_path: path');
  });
  it("uses actual Photo Scanner uploads even when the AI result omits entryMethod", () => {
    const page = read("../app/page.tsx");
    // Web-import images are uploaded to Gemini by the user, not captured by Khalories.
    expect(page).toContain('photoFiles={entryMode === "photo" && photoMethod === "app" ? images : entryMode === "photo" && photoMethod === "web" && webThumbnailFile ? [webThumbnailFile] : []}');
    expect(page).toContain('onThumbnailChange={setWebThumbnailFile}');
    expect(page).not.toContain('photoFiles={entryMode === "photo" ? images : []}');
    expect(page).not.toContain('photoFiles={analysis.entryMethod === "PHOTO_AI" ? images : []}');
  });
});
