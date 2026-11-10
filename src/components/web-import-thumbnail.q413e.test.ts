import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Q4.13E optional private Web Import thumbnail wiring", () => {
  const panel = read("./external-gemini-import-panel.tsx");
  const page = read("../app/page.tsx");
  const saveButton = read("./add-meal-button.tsx");
  it("exposes one optional thumbnail input with limited image formats and size", () => {
    expect(panel).toContain('id="web-import-meal-thumbnail"');
    expect(panel).toContain('type="file"');
    expect(panel).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(panel).toContain('file.size > 15 * 1024 * 1024');
    expect(panel).toContain('Optional photo for Meal History');
    expect(panel).toContain('URL.revokeObjectURL(url)');
  });
  it("passes web upload only to the existing AddMealButton, without mixing app photos", () => {
    expect(page).toContain('const [webThumbnailFile, setWebThumbnailFile] = useState<File | null>(null)');
    expect(page).toContain('onThumbnailChange={setWebThumbnailFile}');
    expect(page).toContain('photoMethod === "app" ? images : entryMode === "photo" && photoMethod === "web" && webThumbnailFile ? [webThumbnailFile] : []');
    expect(page).toContain('setWebThumbnailFile(null); resetAnalysis();');
  });
  it("checks photo storage by default when a photo is attached, preserves opt-out, and avoids AI upload", () => {
    expect(saveButton).toContain('const [savePhoto, setSavePhoto] = useState(photoFiles.length > 0)');
    expect(saveButton).toContain('setSavePhoto(photoFiles.length > 0)');
    expect(saveButton).toContain('setSavePhoto(event.target.checked)');
    expect(saveButton).toContain('checked={savePhoto}');
    expect(saveButton).toContain('if (savePhoto && selectedPhoto)');
    expect(saveButton).toContain('makeMealThumbnail(selectedPhoto)');
    expect(saveButton).toContain('storage.from("meal-thumbnails").upload');
    expect(panel).not.toContain('/api/food/analyze');
    expect(panel).toContain('onThumbnailChange(null)');
  });
});
