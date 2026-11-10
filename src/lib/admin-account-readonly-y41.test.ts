import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./admin-account-actions.ts", import.meta.url), "utf8");

describe("Y4.1 read-only admin detail and destructive action separation", () => {
  it("loads account details with trusted admin role, not destructive-action allowlist", () => {
    const view = source.split("export async function readAdminAccountDetail(")[1]
      .split("export async function performAdminAccountAction(")[0];
    expect(view).toContain("await requireReadOnlyAdmin()");
    expect(view).not.toContain("await requireVerifiedAdmin()");
    expect(source).toContain("hasAdminAppRole(user.app_metadata)");
  });
  it("does not expose enabled destructive buttons to non-allowlisted admins", () => {
    expect(source).toContain("actorMayMutate = adminUidAllowlist(process.env.KHALORIES_ADMIN_USER_IDS)");
    expect(source).toContain("actorMayMutate && !protectedAccount");
  });
  it("retains strict server checks for every destructive operation", () => {
    const action = source.split("export async function performAdminAccountAction(")[1];
    expect(action).toContain("await requireVerifiedAdmin()");
    expect(action).toContain("if (!isApprovedPilotTarget(targetId))");
    expect(source).toContain("enabled: process.env.KHALORIES_ENABLE_ADMIN_ACCOUNT_ACTIONS");
    expect(source).toContain("pilotMode: process.env.KHALORIES_Y4_STAGING_TEST_MODE");
    expect(source).toContain("testTargetId: process.env.KHALORIES_Y4_STAGING_TEST_TARGET_ID");
    expect(action).toContain("isFreshAdminLogin(actor.lastSignInAt)");
    expect(action).toContain("stored !== 0");
  });
});
