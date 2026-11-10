import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { beginnerTourSteps, beginnerTourStorageKey } from "./beginner-tour";
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
describe("Q4.14 launch polish tutorial and performance guards", () => {
  it("covers AI Web Import, barcode, recipes, Meal History and all existing coach stops", () => {
    const ids = beginnerTourSteps.map(step => step.id);
    expect(ids).toEqual(["photo", "web-import", "barcode", "manual", "recipes", "meal-history", "coach-nav", "coach-floating", "coach", "reports", "activities", "settings"]);
    for (const id of ["web-import", "barcode", "recipes", "meal-history"]) {
      expect(beginnerTourSteps.find(step => step.id === id)?.description.length).toBeGreaterThan(40);
    }
    expect(beginnerTourStorageKey("e4b67f18-1234-4b50-a681-afe010123456")).toContain(":v2:");
  });
  it("has visible targets for new tour sections, without triggering scans", () => {
    const page = read("src/app/page.tsx");
    const shell = read("src/components/app-shell.tsx");
    for (const id of ["web-import", "barcode", "saved"]) expect(page).toContain(`data-khalories-tour="${id}"`);
    expect(shell).toContain('data-khalories-tour={item.href === "/meals" ? "meal-history" : undefined}');
    expect(page).toContain('onClick={() => { setPhotoMethod("web")');
    const tutorial = read("src/components/beginner-tour.tsx");
    expect(tutorial).toContain('prefers-reduced-motion: reduce');
    expect(tutorial).toContain('finish("skipped")');
  });
  it("splits secondary log tools into deferred chunks", () => {
    const page = read("src/app/page.tsx");
    for (const file of ["log-food-panel", "external-gemini-import-panel", "barcode-lookup", "saved-food-panel"]) {
      expect(page).toContain(`dynamic(() => import("@/components/${file}")`);
    }
  });
  it("clarifies manual calculator serving units and opt-in photo tips", () => {
    const calculator = read("src/components/quick-nutrition-calculator.tsx");
    expect(calculator).toContain("How much did you eat?");
    expect(calculator).toContain("Measured in");
    expect(calculator).toContain("Add this portion to my meal");
    const help = read("src/components/log-food-help-panel.tsx");
    expect(help).toContain("AI Web Import");
    expect(help).toContain("opt in");
  });
});
