import { describe, it, expect } from "vitest";
import { isY4StagingPilotTarget } from "./admin-account-staging-guard";

const good = {
  enabled: "true", pilotMode: "true", projectUrl: "https://scjkerxusadqzadbboyl.supabase.co",
  testTargetId: "22222222-2222-4222-8222-222222222222",
};
const target = good.testTargetId;
describe("Y4.2 staging destructive-action pilot lock", () => {
  it("allows only the designated staging disposable target with all gates enabled", () => {
    expect(isY4StagingPilotTarget(target, good)).toBe(true);
  });
  it("never allows any other target", () => {
    expect(isY4StagingPilotTarget("33333333-3333-4333-8333-333333333333", good)).toBe(false);
  });
  it("rejects missing or false feature flags", () => {
    expect(isY4StagingPilotTarget(target, {...good, enabled: "false"})).toBe(false);
    expect(isY4StagingPilotTarget(target, {...good, pilotMode: undefined})).toBe(false);
  });
  it("rejects production, lookalike, insecure and credentialed URLs", () => {
    for (const u of ["https://wsrtbwiggqifdmifcwao.supabase.co", "https://scjkerxusadqzadbboyl.supabase.co.evil.test", "http://scjkerxusadqzadbboyl.supabase.co", "https://user:pass@scjkerxusadqzadbboyl.supabase.co", "invalid"]) {
      expect(isY4StagingPilotTarget(target, {...good, projectUrl: u})).toBe(false);
    }
  });
  it("rejects absent, invalid, and mismatched pilot account IDs", () => {
    expect(isY4StagingPilotTarget(target, {...good, testTargetId: undefined})).toBe(false);
    expect(isY4StagingPilotTarget(target, {...good, testTargetId: "other"})).toBe(false);
  });
});
