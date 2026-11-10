import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const manual = readFileSync("src/components/log-food-panel.tsx", "utf8");
const page = readFileSync("src/app/page.tsx", "utf8");
describe("Manual Log Food navigation", () => {
  it("separates the four tools", () => {
    for (const label of ["Find Food", "Calculator", "Enter Details", "AI Estimate"]) expect(manual).toContain(label);
    expect(manual).toContain('aria-pressed={tool === id}');
  });
  it("preserves search, calculator, meal review and switches to details after autofill", () => {
    expect(manual).toContain('<FoodSmartSearch mode="manual" onSelect={selectSmartFood} />');
    expect(manual).toContain('<QuickNutritionCalculator onUse={selectQuickNutrition} />');
    expect(manual).toContain('<form onSubmit={handleReview}');
    expect(manual.split('setTool("details")').length-1).toBeGreaterThanOrEqual(3);
  });
  it("keeps the native Text AI dropdown only within the AI workflow", () => {
    expect(manual).toContain('{aiProviderPicker}');
    expect(page).toContain('aiProviderPicker={<AiProviderPicker mode="manual"');
    // The provider picker remains visible for Khalories' own AI, never Gemini Web Import.
    expect(page).toContain('{entryMode === "photo" && photoMethod === "app" && <AiProviderPicker');
    expect(page).toContain('AI Web Import');
  });
});
