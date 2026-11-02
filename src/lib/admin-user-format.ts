/** Sanitize a restricted page of Supabase Auth users for a read-only admin directory. */
export type AdminDirectoryUser = {
  id: string;
  email: string;
  joined: string;
  lastSignIn: string;
  role: "Admin" | "Member";
  status: "Suspended" | "Confirmed" | "Unverified";
};

type LooseUser = {
  id?: unknown;
  email?: unknown;
  created_at?: unknown;
  last_sign_in_at?: unknown;
  confirmed_at?: unknown;
  email_confirmed_at?: unknown;
  banned_until?: unknown;
  app_metadata?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function formatAdminDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "Unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
  }).format(parsed);
}

export function presentAdminUsers(users: unknown, now = new Date()): AdminDirectoryUser[] | null {
  if (!Array.isArray(users) || users.length > 20 || !Number.isFinite(now.getTime())) return null;
  const result: AdminDirectoryUser[] = [];
  for (const item of users) {
    if (!isObject(item)) return null;
    const row = item as LooseUser;
    if (typeof row.id !== "string" || !/^[0-9a-f-]{36}$/i.test(row.id)) return null;
    const role = isObject(row.app_metadata) && row.app_metadata.khalories_role === "admin" ? "Admin" : "Member";
    const suspended = typeof row.banned_until === "string" &&
      Number.isFinite(Date.parse(row.banned_until)) && Date.parse(row.banned_until) > now.getTime();
    result.push({
      id: row.id,
      email: typeof row.email === "string" && row.email.trim() ? row.email : "No email address",
      joined: formatAdminDate(row.created_at),
      lastSignIn: formatAdminDate(row.last_sign_in_at),
      role,
      status: suspended ? "Suspended" : row.confirmed_at || row.email_confirmed_at ? "Confirmed" : "Unverified",
    });
  }
  return result;
}

export function safeAdminPage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 10000 ? page : 1;
}
