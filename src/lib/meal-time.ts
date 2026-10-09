/**
 * Convert an optional eating timestamp into a validated UTC ISO value.
 *
 * undefined: use the database default (NOW)
 * null: invalid timestamp
 * string: valid eating time
 *
 * The browser converts the user's local eating time
 * to ISO UTC before sending it to the server.
 */
export function normalizeConsumedAt(
  value: string | undefined,
  now: Date = new Date()
): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return null;
  }

  const parsed = new Date(value);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    return null;
  }

  // A short allowance handles minor device clock differences.
  const maximumAllowed =
    now.getTime() + 5 * 60 * 1000;

  if (parsed.getTime() > maximumAllowed) {
    return null;
  }

  return parsed.toISOString();
}