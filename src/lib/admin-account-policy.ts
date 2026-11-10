/** Shared, pure validation for destructive admin account requests. */
export const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type AccountOperation = "reset" | "delete";
export type AccountActionRequest = {
  targetId: string;
  operation: AccountOperation;
  expectedEmail: string;
  typedEmail: string;
  confirmation: string;
  reason: string;
};

export function adminUidAllowlist(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map(s => s.trim().toLowerCase()).filter(s => accountIdPattern.test(s));
}

export function verifyAccountActionInput(input: unknown):
  | { ok: true; data: AccountActionRequest }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, message: "Invalid request." };
  const row = input as Record<string, unknown>;
  if (typeof row.targetId !== "string" || !accountIdPattern.test(row.targetId)) return { ok: false, message: "Invalid account identifier." };
  if (row.operation !== "reset" && row.operation !== "delete") return { ok: false, message: "Invalid account operation." };
  const operation = row.operation;
  if (typeof row.expectedEmail !== "string" || !row.expectedEmail.includes("@") || row.expectedEmail.length > 320) return { ok: false, message: "Target email unavailable." };
  if (typeof row.typedEmail !== "string" || row.typedEmail.trim().toLowerCase() !== row.expectedEmail.trim().toLowerCase()) return { ok: false, message: "Type the exact target email to confirm." };
  if (typeof row.confirmation !== "string" || row.confirmation !== (operation === "reset" ? "RESET ACCOUNT" : "DELETE ACCOUNT")) return { ok: false, message: "Type the required confirmation phrase." };
  if (typeof row.reason !== "string" || row.reason.trim().length < 12 || row.reason.length > 500) return { ok: false, message: "Enter a request/reference reason (12–500 characters)." };
  return { ok: true, data: { targetId: row.targetId, operation, expectedEmail: row.expectedEmail.trim(), typedEmail: row.typedEmail.trim(), confirmation: row.confirmation, reason: row.reason.trim() } };
}
