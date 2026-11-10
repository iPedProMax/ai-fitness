import { describe, expect, it } from "vitest";
import { formatAdminDate, presentAdminUsers, safeAdminPage } from "./admin-user-format";

const id = "c0802bbf-3ad4-4b24-86d4-096fd5511a3b";

describe("Y3 sanitized read-only account directory", () => {
  it("shows only safe admin-facing fields, not raw metadata or sensitive account attributes", () => {
    const users = presentAdminUsers([{ id, email: "example@example.com", created_at: "2026-10-31T20:00:00Z",
      last_sign_in_at: null, email_confirmed_at: "2026-10-31T22:00:00Z",
      user_metadata: { location: "private" }, app_metadata: { khalories_role: "admin", secret: "private" } }]);
    expect(users).toEqual([{ id, email: "example@example.com", joined: "Nov 1, 2026",
      lastSignIn: "Unavailable", role: "Admin", status: "Confirmed" }]);
    expect(JSON.stringify(users)).not.toContain("private");
  });
  it("treats a user-editable metadata admin claim as a normal member", () => {
    expect(presentAdminUsers([{id, user_metadata: { khalories_role: "admin" }, created_at:"invalid"}])?.[0]).toMatchObject({role:"Member", status:"Unverified", joined:"Unavailable"});
  });
  it("labels an actively banned account as suspended and an expired ban as unsuspended", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(presentAdminUsers([{id, banned_until:"2026-11-03T00:00:00Z"}],now)?.[0].status).toBe("Suspended");
    expect(presentAdminUsers([{id, banned_until:"2026-10-01T00:00:00Z",confirmed_at:"2026-10-01T00:00:00Z"}],now)?.[0].status).toBe("Confirmed");
  });
  it("rejects malformed pages and more than 20 returned accounts", () => {
    expect(presentAdminUsers([{}])).toBeNull();
    expect(presentAdminUsers(Array.from({length:21},()=>({id})))).toBeNull();
    expect(presentAdminUsers([{id:"bad"}])).toBeNull();
  });
  it("validates page input conservatively", () => {
    expect(safeAdminPage("3")).toBe(3);
    for (const unsafe of [undefined,"0","-1","01","1.1","1&role=admin","10001"]) expect(safeAdminPage(unsafe)).toBe(1);
  });
  it("renders Manila calendar dates and refuses invalid timestamps", () => {
    expect(formatAdminDate("2026-10-31T20:00:00Z")).toBe("Nov 1, 2026");
    expect(formatAdminDate(null)).toBe("Unavailable");
  });
});
