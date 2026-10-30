/** Pages that require a signed-in AI Fitness account. */
export function isProtectedAppPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/meals" ||
    pathname === "/barcode" ||
    pathname === "/recipes" ||
    pathname.startsWith("/meals/") ||
    pathname === "/activities" ||
    pathname.startsWith("/activities/") ||
    pathname === "/goals" ||
    pathname.startsWith("/goals/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}