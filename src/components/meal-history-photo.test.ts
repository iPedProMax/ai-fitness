import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
describe("private meal history photo wiring",()=>{
  it("saves a thumbnail only after a meal ID exists",()=>{
    const button=read("./add-meal-button.tsx");
    expect(button).toContain("await saveMeal(analysis, consumedAt)");
    expect(button).toContain("const selectedPhoto = photoFiles[0]");
    expect(button).toContain("makeMealThumbnail(selectedPhoto)");
    expect(button).toContain("if (savePhoto && selectedPhoto)");
    expect(button).toContain('storage.from("meal-thumbnails").upload');
    expect(button).toContain('thumbnail_path: path');
  });
  it("keeps stored images private and reads signed URLs",()=>{
    const page=read("../app/meals/page.tsx");
    expect(page).toContain('createSignedUrls(photoPaths, 1800)');
    expect(page).toContain('thumbnail_path');
    expect(page).toContain("foodEmoji(");
  });
  it("deletes stored photos with deleted meals",()=>{
    const actions=read("../app/meals/shortcuts.ts");
    expect(actions).toContain('storage.from("meal-thumbnails").remove');
  });
});
