import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Only trusted Supabase app_metadata can authorize administrative access. */
export function hasAdminAppRole(metadata: unknown): boolean {
  return metadata !== null && typeof metadata === "object" && !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).khalories_role === "admin";
}

export async function getAdminAccess(): Promise<{ signedIn: boolean; isAdmin: boolean }> {
  try {
    const client = await createClient();
    // getUser validates with Supabase Auth, unlike trusting an unverified session cookie.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { signedIn: false, isAdmin: false };
    return { signedIn: true, isAdmin: hasAdminAppRole(data.user.app_metadata) };
  } catch {
    return { signedIn: false, isAdmin: false };
  }
}
