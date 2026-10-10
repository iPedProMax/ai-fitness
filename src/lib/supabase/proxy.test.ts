import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getClaimsMock } = vi.hoisted(() => ({
  getClaimsMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: getClaimsMock },
  }),
}));

import { updateSession } from "./proxy";

const request = (pathname: string) =>
  new NextRequest(`https://ai-fitness-green-six.vercel.app${pathname}`);

describe("Supabase page access proxy", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getClaimsMock.mockResolvedValue({ data: { claims: null }, error: null });
  });

  it.each(["/", "/dashboard", "/meals"])(
    "redirects unsigned-in users away from %s",
    async (pathname) => {
      const response = await updateSession(request(pathname));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://ai-fitness-green-six.vercel.app/auth/login"
      );
    }
  );

  it("keeps sign-in and sign-up pages public", async () => {
    for (const pathname of ["/auth/login", "/auth/sign-up", "/auth/confirm"]) {
      const response = await updateSession(request(pathname));
      expect(response.status).toBe(200);
    }
  });

  it("does not block authenticated users", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "test-user" } },
      error: null,
    });
    const response = await updateSession(request("/dashboard"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("fails closed on protected pages if claims lookup fails", async () => {
    getClaimsMock.mockRejectedValue(new Error("Temporary auth failure"));
    const response = await updateSession(request("/meals"));
    expect(response.status).toBe(307);
  });
});