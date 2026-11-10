import { describe, expect, it } from "vitest";
import { coachPrompt, coachRequestSchema } from "./coach-prompt";
import type { CoachUserSummary } from "@/lib/coach-insights";
const summary: CoachUserSummary = {
  asOfDay: "2026-10-30", today: { mealCount: 2, calories: 1200, proteinGrams: 75, proteinIncomplete: false },
  past7Days: { daysWithMeals: 5, mealCount: 12, activitySessions: 3, activityMinutes: 95 },
  goal: { type: "lose", calories: 1900, proteinGrams: 120, targetWeightKg: 70 },
  latestWeight: { kg: 77, date: "2026-10-29" }, recentFoodNames: ["Tinola", "Rice"], limitedHistory: false,
};
describe("AURA opt-in personalization", () => {
  it("defaults off and includes no saved context", () => {
    const request = coachRequestSchema.parse({ model: "ollama-local", message: "How is my day?" });
    expect(request.useSavedData).toBe(false);
    expect(coachPrompt(request.message, [])).toContain("no access to saved meals");
    expect(coachPrompt(request.message, [])).not.toContain("Tinola");
  });
  it("accepts explicit opt-in but no client-supplied user data", () => {
    expect(coachRequestSchema.parse({ model: "ollama-local", message: "Help me", useSavedData: true }).useSavedData).toBe(true);
    expect(coachRequestSchema.safeParse({ model: "ollama-local", message: "Help me", useSavedData: true, summary }).success).toBe(false);
  });
  it("only adds server-provided summary when passed explicitly", () => {
    const prompt = coachPrompt("What protein do I need?", [], summary);
    expect(prompt).toContain("Tinola");
    expect(prompt).toContain('"proteinGrams":120');
    expect(prompt).toContain("not medical records");
    expect(prompt).toContain("untrusted JSON");
  });
});
