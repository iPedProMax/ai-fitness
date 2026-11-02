import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Y3 Auth directory protection and privacy", () => {
  it("requires admin authorization before any trusted Auth lookup", () => {
    const source = read("./admin-users.ts");
    expect(source).toContain('import "server-only"');
    expect(source).toContain("await getAdminAccess()");
    expect(source).toContain('if (!access.isAdmin) throw new Error("Admin authorization required")');
    expect(source.indexOf("await getAdminAccess()")).toBeLessThan(source.indexOf("client.auth.admin.listUsers"));
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("perPage: PAGE_SIZE");
    for (const mutation of ["deleteUser(","updateUserById(","createUser(","inviteUserByEmail("]) expect(source).not.toContain(mutation);
  });
  it("server-gates the route and prevents static caching", () => {
    const source = read("../app/admin/analytics/users/page.tsx");
    expect(source).toContain('dynamic = "force-dynamic"');
    expect(source).toContain("if (!access.isAdmin) notFound()");
    expect(source.indexOf("if (!access.isAdmin) notFound()")).toBeLessThan(source.indexOf("await readAdminUsers(current)"));
    expect(source).not.toContain('"use client"');
  });
  it("client-only search performs no requests or account edits", () => {
    const source = read("../components/admin-user-directory.tsx");
    expect(source).toContain("useMemo");
    expect(source).toContain("users.filter");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("links back to the private admin dashboard", () => {
    const source = read("../app/admin/analytics/page.tsx");
    expect(source).toContain('href="/admin/analytics/users"');
  });
});
