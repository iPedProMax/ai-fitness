import "server-only";
import { createClient as trustedClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { presentAdminUsers, type AdminDirectoryUser } from "@/lib/admin-user-format";

const PAGE_SIZE = 20;
export type AdminUserDirectory = {
  status: "ready" | "unavailable";
  users: AdminDirectoryUser[];
  page: number;
  total: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
};

/** Privileged Auth metadata is read ONLY after a fresh server-side admin check. */
export async function readAdminUsers(page: number): Promise<AdminUserDirectory> {
  const access = await getAdminAccess();
  if (!access.isAdmin) throw new Error("Admin authorization required");
  const selected = Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
  const fallback: AdminUserDirectory = {
    status: "unavailable", users: [], page: selected,
    total: null, hasPrevious: selected > 1, hasNext: false,
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fallback;
  try {
    // Service key stays on the server; no user_metadata, raw JWT, or user health data is exposed.
    const client = trustedClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.admin.listUsers({ page: selected, perPage: PAGE_SIZE });
    if (error || !data) return fallback;
    const users = presentAdminUsers(data.users);
    if (!users) return fallback;
    const total = typeof data.total === "number" && Number.isSafeInteger(data.total) && data.total >= 0
      ? data.total : null;
    const hasNext = typeof data.nextPage === "number" ? data.nextPage > selected :
      total !== null ? selected * PAGE_SIZE < total : users.length === PAGE_SIZE;
    return { status: "ready", users, page: selected, total, hasPrevious: selected > 1, hasNext };
  } catch {
    return fallback;
  }
}
