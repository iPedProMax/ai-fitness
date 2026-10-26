import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = readFileSync(new URL("./exercise-display-settings.tsx", import.meta.url), "utf8");
const summary = readFileSync(new URL("./today-overview.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/activities/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./activity-form.tsx", import.meta.url), "utf8");
const routeProtection = readFileSync(new URL("../lib/supabase/protected-app-page.ts", import.meta.url), "utf8");

describe("Account-based exercise visibility", () => {
  it("has an accessible toggle and clear, beginner-friendly labels", () => {
    expect(settings).toContain('role="switch"');
    expect(settings).toContain("Show calories burned");
    expect(settings).toContain("Food intake only");
  });
  it("never modifies meals, exercises, or AI quota when switching visibility", () => {
    expect(settings).toContain("saveExerciseDisplayPreference(next)");
    expect(settings).not.toContain("deleteActivity");
    expect(settings).not.toContain("reserveAiUsage");
  });
  it("uses the signed-in user's preference on the dashboard and Activity page", () => {
    expect(summary).toContain('.from("user_preferences")');
    expect(summary).toContain('.eq("user_id", authData.user.id)');
    expect(summary).toContain('state.exercise.status === "ready"');
    expect(page).toContain('.from("user_preferences")');
    expect(page).toContain('{showExerciseCalories && <p');
    expect(form).toContain('{showExerciseCalories && <div');
  });
  it("protects the settings route", () => {
    expect(routeProtection).toContain('pathname === "/settings"');
  });
});
