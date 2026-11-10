import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
describe("warm wellness makeover feature wiring", () => {
  it("consolidates three food logging methods without replacing the analyzer", () => {
    const home = read("../app/page.tsx");
    expect(home).toContain('"photo" | "manual" | "barcode"');
    expect(home).toContain("<BarcodeLookup />");
    expect(home).toContain('entryMode === "barcode"');
    expect(home).toContain("selectMealImages(images, incoming, MAX_IMAGES)");
    expect(home).toContain("<AiProviderPicker");
  });
  it("keeps a short primary navigation and floating optional AURA", () => {
    const shell = read("./app-shell.tsx");
    expect(shell).toContain("<AuraFloatingCoach />");
    expect(shell).not.toContain('label: "Barcode & Food Search"');
    expect(shell).toContain('label: "Meal History"');
    expect(shell).toContain('href: "/goals"');
  });
  it("never submits personal data in the mini coach by default", () => {
    const coach = read("./aura-floating-coach.tsx");
    expect(coach).toContain("useState(false)");
    expect(coach).toContain("useSavedData: personalize");
    expect(coach).toContain('submitAiRequest("/api/coach/chat"');
    expect(coach).toContain('fetch("/api/coach/local"');
  });
  it("uses actual records for the dashboard instead of illustrative meals", () => {
    const today = read("./today-overview.tsx");
    expect(today).toContain('supabase.auth.getUser()');
    expect(today).toContain('.eq("user_id", authData.user.id)');
    expect(today).toContain('summarizeDailyNutrition(meals)');
    expect(today).toContain('meal.meal_items?.map');
    expect(today).not.toContain("Oats & banana");
  });
});
