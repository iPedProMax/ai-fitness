"use server";
import { createClient as createTrustedClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccountDatabase } from "@/lib/admin-account-db-types";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, hasAdminAppRole } from "@/lib/admin-access";
import { adminUidAllowlist, accountIdPattern, verifyAccountActionInput } from "@/lib/admin-account-policy";
import type { AccountOperation } from "@/lib/admin-account-policy";
import { isY4StagingPilotTarget } from "@/lib/admin-account-staging-guard";

const USER_TABLES = ["meals", "meal_items", "activities", "fitness_goals", "weight_entries", "water_entries", "meal_templates", "user_preferences", "user_barcode_foods"] as const;

function isApprovedPilotTarget(targetId: string): boolean {
  return isY4StagingPilotTarget(targetId, {
    enabled: process.env.KHALORIES_ENABLE_ADMIN_ACCOUNT_ACTIONS,
    pilotMode: process.env.KHALORIES_Y4_STAGING_TEST_MODE,
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    testTargetId: process.env.KHALORIES_Y4_STAGING_TEST_TARGET_ID,
  });
}

type AdminClient = SupabaseClient<AdminAccountDatabase>;
export type AccountDetail = {
  id: string; email: string; status: "ready" | "unavailable";
  protectedAccount: boolean; counts: { name: string; count: number | null }[];
  storageCount: number | null; actionsEnabled: boolean;
};
export type AccountOperationResult = { ok: boolean; message: string };

function getTrustedClient(): AdminClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createTrustedClient<AdminAccountDatabase>(url, key, {auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }});
}

/** Read-only account details require the same trusted admin role as the user directory.
 * A separate UID allowlist gates destructive actions only, never browsing. */
async function requireReadOnlyAdmin(): Promise<{ id: string }> {
  const access = await getAdminAccess();
  if (!access.isAdmin) throw new Error("Administrator authorization required.");
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || !hasAdminAppRole(user.app_metadata)) {
    throw new Error("Administrator authentication required.");
  }
  return { id: user.id };
}

async function requireVerifiedAdmin(): Promise<{ id: string; lastSignInAt: string | undefined }> {
  const access = await getAdminAccess();
  if (!access.isAdmin) throw new Error("Administrator authorization required.");
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || !hasAdminAppRole(user.app_metadata)) throw new Error("Administrator authentication required.");
  if (!adminUidAllowlist(process.env.KHALORIES_ADMIN_USER_IDS).includes(user.id.toLowerCase())) {
    throw new Error("Destructive account controls require explicit administrator allowlisting.");
  }
  return { id: user.id, lastSignInAt: user.last_sign_in_at };
}

function isFreshAdminLogin(value: string | undefined): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= Date.now() + 30000 && time >= Date.now() - 10 * 60000;
}

async function findProtectedTarget(client: AdminClient, targetId: string, actorId: string) {
  const {data, error} = await client.auth.admin.getUserById(targetId);
  if (error || !data?.user || !data.user.email) throw new Error("Target account unavailable.");
  const target = data.user;
  const allowlisted = adminUidAllowlist(process.env.KHALORIES_ADMIN_USER_IDS).includes(target.id.toLowerCase());
  const protectedAccount = target.id === actorId || allowlisted || hasAdminAppRole(target.app_metadata);
  return { target, protectedAccount };
}

/** Returns counts only; no user's personal food/health details are returned to the page. */
export async function readAdminAccountDetail(targetId: string): Promise<AccountDetail> {
  const actor = await requireReadOnlyAdmin();
  if (!accountIdPattern.test(targetId)) throw new Error("Invalid account ID.");
  const client = getTrustedClient();
  if (!client) return {id:targetId,email:"Unavailable",status:"unavailable",protectedAccount:true,counts:[],storageCount:null,actionsEnabled:false};
  const { target, protectedAccount } = await findProtectedTarget(client, targetId, actor.id);
  const counts = await Promise.all(USER_TABLES.map(async table => {
    const { count, error } = await client.from(table).select("*", { head: true, count: "exact" }).eq("user_id", targetId);
    return { name: table, count: error ? null : count };
  }));
  const { data: stored, error: storageError } = await client.rpc("khalories_admin_user_storage_count", { p_user_id: targetId });
  const storageCount = !storageError && typeof stored === "number" && Number.isSafeInteger(stored) ? stored : null;
  // A successful read-only admin check does NOT grant authority to mutate.
  const actorMayMutate = adminUidAllowlist(process.env.KHALORIES_ADMIN_USER_IDS).includes(actor.id.toLowerCase());
  const actionsEnabled = isApprovedPilotTarget(targetId) && actorMayMutate && !protectedAccount && storageCount === 0 && counts.every(item => item.count !== null);
  return { id: target.id, email: target.email ?? "Unavailable", status:"ready", protectedAccount, counts, storageCount, actionsEnabled };
}

/** Privileged action: protected by role+allowlist+recent login+target recheck+audit+storage guard. */
export async function performAdminAccountAction(input: unknown): Promise<AccountOperationResult> {
  try {
    const checked = verifyAccountActionInput(input);
    if (!checked.ok) return {ok:false,message:checked.message};
    const {targetId,operation,expectedEmail,reason} = checked.data;
    const actor = await requireVerifiedAdmin();
    if (!isFreshAdminLogin(actor.lastSignInAt)) return {ok:false,message:"For security, sign out and sign back in within 10 minutes before this action."};
    if (!isApprovedPilotTarget(targetId)) return {ok:false,message:"Account actions are locked to the single designated disposable account on the staging project. No other account is eligible."};
    const client = getTrustedClient();
    if (!client) return {ok:false,message:"Server-only Supabase credentials are not configured."};
    const { target, protectedAccount } = await findProtectedTarget(client, targetId, actor.id);
    if (protectedAccount) return {ok:false,message:"Administrator, allowlisted, and self accounts cannot be modified."};
    if ((target.email ?? "").toLowerCase() !== expectedEmail.toLowerCase()) return {ok:false,message:"Target account has changed. Reload and verify its email."};
    const { data: stored, error: storageError } = await client.rpc("khalories_admin_user_storage_count", { p_user_id: targetId });
    if (storageError || typeof stored !== "number") return {ok:false,message:"Storage preflight unavailable. Install the audited SQL migration first."};
    if (stored !== 0) return {ok:false,message:"Account contains stored photos/files. Remove them through Supabase Storage with verified ownership before retrying; no records were changed."};
    // Throttle destructive requests by actor; audit must exist and be readable.
    const oneHourAgo = new Date(Date.now() - 60 * 60000).toISOString();
    const {count, error: auditReadError} = await client.from("khalories_admin_account_audit")
      .select("id", {head:true,count:"exact"}).eq("actor_user_id",actor.id).gte("created_at",oneHourAgo);
    if (auditReadError || count === null) return {ok:false,message:"Audit log unavailable; no action performed."};
    if (count >= 5) return {ok:false,message:"Safety limit: maximum five account actions per hour."};
    if (operation === "reset") {
      // Atomic SQL transaction: all tracking tables + audit together, or none.
      const { error } = await client.rpc("khalories_admin_reset_tracking", {
        p_actor_user_id: actor.id, p_target_user_id: targetId, p_reason: reason,
      });
      if (error) return {ok:false,message:"Reset failed. No successful reset was recorded. Check server logs and the SQL migration."};
      return {ok:true,message:"Tracking data reset. Login and AI usage limits were preserved; an audit entry was recorded."};
    }
    // Audit *before* invoking the Auth Admin API; never delete without an audit row.
    const {data: audit, error: insertError} = await client.from("khalories_admin_account_audit")
      .insert({actor_user_id:actor.id,target_user_id:targetId,action:operation as AccountOperation,reason,outcome:"started"})
      .select("id").single();
    if (insertError || !audit) return {ok:false,message:"Could not create required audit record. No deletion performed."};
    const {error: deletionError} = await client.auth.admin.deleteUser(targetId, false);
    const {error: updateError} = await client.from("khalories_admin_account_audit")
      .update({outcome:deletionError?"failed":"completed"}).eq("id",audit.id);
    if (deletionError) return {ok:false,message:"Supabase refused account deletion. Check foreign keys and Storage ownership. Attempt was audited."};
    if (updateError) return {ok:true,message:"Account was deleted, but final audit status could not be updated; inspect the audit record immediately."};
    return {ok:true,message:"Account deleted. Linked user records cascade by database constraints; action audited."};
  } catch {
    return {ok:false,message:"Action blocked by administrator or target verification. No unverified action was authorized."};
  }
}
