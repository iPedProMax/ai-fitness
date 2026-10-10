/** Pages that require a signed-in AI Fitness account. */
export function isProtectedAppPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/meals" ||
    pathname.startsWith("/meals/")
  );
}