import { beforeEach, describe, expect, it, vi } from "vitest";

const { guardMock } = vi.hoisted(() => ({ guardMock: vi.fn() }));
vi.mock("@/lib/food-api-auth", () => ({
  requireFoodApiAuth: guardMock,
}));

import { POST as analyze } from "@/app/api/food/analyze/route";
import { POST as refine } from "@/app/api/food/refine/route";
import { POST as text } from "@/app/api/food/text/route";

const routes = [
  ["image", analyze, "/api/food/analyze"],
  ["refine", refine, "/api/food/refine"],
  ["text", text, "/api/food/text"],
] as const;

describe("all Gemini routes reject requests before reading bodies", () => {
  beforeEach(() => {
    guardMock.mockReset();
    guardMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  for (const [label, handler, path] of routes) {
    it(`${label} returns HTTP 401 before parsing input`, async () => {
      const response = await handler(new Request(`http://localhost:3000${path}`, {
        method: "POST",
        // Invalid/absent request body should not take precedence over the guard.
      }));
      expect(response.status).toBe(401);
      expect(guardMock).toHaveBeenCalledOnce();
    });
  }
});