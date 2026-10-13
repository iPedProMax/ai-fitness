import { describe, expect, it } from "vitest";
import { isProtectedAppPage } from "./protected-app-page";

describe("account-only page routes", () => {
  it.each(["/", "/dashboard", "/dashboard/", "/meals", "/meals/1", "/activities", "/activities/history", "/settings", "/settings/preferences"])(
    "requires authentication for %s",
    (pathname) => {
      expect(isProtectedAppPage(pathname)).toBe(true);
    }
  );

  it.each([
    "/auth/login",
    "/auth/sign-up",
    "/auth/confirm",
    "/auth/callback",
    "/api/food/analyze",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/dashboard-public",
    "/meals-info",
    "/activities-info",
  ])("does not redirect public/non-page path %s", (pathname) => {
    expect(isProtectedAppPage(pathname)).toBe(false);
  });
});