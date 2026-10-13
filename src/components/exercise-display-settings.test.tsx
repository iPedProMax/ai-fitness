import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExerciseDisplaySettings } from "./exercise-display-settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/settings/actions", () => ({
  saveExerciseDisplayPreference: vi.fn(),
}));

describe("Visible exercise preference control", () => {
  it("renders a visible OFF button when exercise calories are hidden", () => {
    const html = renderToStaticMarkup(
      <ExerciseDisplaySettings initialShowExerciseCalories={false} />
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain(">OFF</button>");
    expect(html).toContain("Show calories burned");
  });

  it("renders a visible ON button when exercise calories are shown", () => {
    const html = renderToStaticMarkup(
      <ExerciseDisplaySettings initialShowExerciseCalories={true} />
    );
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(">ON</button>");
  });
});
