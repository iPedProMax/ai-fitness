import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui = readFileSync(new URL("./barcode-lookup.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/barcode/actions.ts", import.meta.url), "utf8");
describe("My Foods saved nutrition feedback", () => {
  it("shows both success and error feedback next to the save action", () => {
    const label = 'Save reviewed nutrition to My Foods';
    const saveButton = ui.lastIndexOf(label);
    expect(saveButton).toBeGreaterThan(0);
    const nearButton = ui.slice(saveButton, saveButton + 700);
    expect(nearButton).toContain('{myFoodNotice&&<p role="status"');
    expect(nearButton).toContain('aria-live="polite"');
    expect(nearButton).toContain('border-rose-300');
    expect(nearButton).toContain('border-emerald-300');
  });
  it("captures non-secret error codes on the development server", () => {
    expect(actions).toContain('[MY_FOODS_SAVE_ERROR]');
    expect(actions).toContain('[MY_FOODS_LOOKUP_ERROR]');
    expect(actions).not.toContain('service_role');
  });
});