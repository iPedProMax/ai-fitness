/** Y4.2: locked pilot mode. No production or non-test targets may be mutated. */
import { accountIdPattern } from "@/lib/admin-account-policy";

export type Y4PilotConfig = {
  enabled?: string;
  pilotMode?: string;
  projectUrl?: string;
  testTargetId?: string;
};

export function isY4StagingPilotTarget(targetId: string, config: Y4PilotConfig): boolean {
  if (config.enabled !== "true" || config.pilotMode !== "true") return false;
  if (!accountIdPattern.test(targetId) || !accountIdPattern.test(config.testTargetId ?? "")) return false;
  if (targetId.toLowerCase() !== config.testTargetId?.toLowerCase()) return false;
  try {
    const u = new URL(config.projectUrl ?? "");
    // Hard lock to the reviewed staging Supabase project. No user-supplied hostname.
    return u.protocol === "https:" && u.hostname === "scjkerxusadqzadbboyl.supabase.co"
      && !u.username && !u.password && !u.port && (u.pathname === "/" || u.pathname === "");
  } catch { return false; }
}
