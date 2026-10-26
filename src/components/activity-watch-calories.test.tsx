import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/activities/actions", () => ({
  saveActivity: vi.fn(),
}));

import { ActivityForm } from "./activity-form";

describe("Watch calories versus exercise display preference", () => {
  it("keeps manual watch-calorie entry available with the calorie display off", () => {
    const html = renderToStaticMarkup(<ActivityForm showExerciseCalories={false} />);
    expect(html).toContain("Calories from watch");
    expect(html).toContain("You can save watch calories even when calorie displays are hidden in Settings.");
    expect(html).not.toContain("Calories burned</p>");
  });

  it("keeps watch entry and shows the calorie estimate when display is on", () => {
    const html = renderToStaticMarkup(<ActivityForm showExerciseCalories={true} />);
    expect(html).toContain("Calories from watch");
    expect(html).toContain("Calories burned</p>");
  });
});
