import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FitnessGoalForm } from "./fitness-goal-form";

vi.mock("@/app/goals/actions", () => ({ saveFitnessGoal: vi.fn() }));

describe("compact beginner-friendly fitness goals", () => {
  it("renders a readable compact two-column layout and keeps advanced fields optional", () => {
    const html = renderToStaticMarkup(<FitnessGoalForm initialGoal={null} />);
    expect(html).toContain("max-w-4xl");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("lg:col-span-2");
    expect(html).toContain("gap-x-6");
    expect(html).toContain("No maths needed");
    expect(html).toContain("0 AI credits");
    expect(html).toContain("Calculate my targets");
    expect(html).toContain("Adjust my goals (optional)");
    expect(html).toContain('id="calorie-target"');
    expect(html).toContain('id="protein-target"');
    expect(html).toContain("Save my goals");
    expect(html).not.toContain("Use these targets");
  });

  it("uses accessible buttons for feet/inches and centimetres", () => {
    const html = renderToStaticMarkup(<FitnessGoalForm initialGoal={null} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Height units"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('id="tdee-height-feet"');
    expect(html).toContain('id="tdee-height-inches"');
    expect(html).toContain("ft / in");
    expect(html).toContain(">cm</button>");
  });

  it("retains previously saved user goals", () => {
    const html = renderToStaticMarkup(<FitnessGoalForm initialGoal={{ goal_type: "lose", calorie_target: 1950, protein_target: 110, target_weight_kg: 70 }} />);
    expect(html).toContain("previously saved");
    expect(html).toContain('value="1950"');
    expect(html).toContain('value="110"');
    expect(html).toContain('value="70"');
  });

  it("keeps the original TDEE calculation and save flow", () => {
    const code = readFileSync(new URL("./fitness-goal-form.tsx", import.meta.url), "utf8");
    expect(code).toContain("calculateTdee({");
    expect(code).toContain("setCalories(String(result.suggestedCalories))");
    expect(code).toContain("setProtein(String(result.suggestedProteinGrams))");
    expect(code).toContain("saveFitnessGoal({ goalType, calorieTarget, proteinTarget, targetWeightKg })");
    expect(code).toContain("feetInchesToCentimeters");
    const page = readFileSync(new URL("../app/goals/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("max-w-4xl");
  });
});
