/** Philippine calendar days for private admin aggregate charts. No user data here. */
export function manilaDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find(part => part.type === type)?.value;
  const year = pick("year"); const month = pick("month"); const day = pick("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}
export function lastSevenManilaDays(now: Date): string[] {
  const today = manilaDateKey(now);
  if (!today) throw new Error("Invalid current date");
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day - 6 + i)).toISOString().slice(0, 10));
}
export function countByManilaDay(timestamps: string[], days: string[]): number[] {
  const counts = new Map(days.map(day => [day, 0]));
  for (const timestamp of timestamps) {
    const day = manilaDateKey(timestamp);
    if (day && counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return days.map(day => counts.get(day) ?? 0);
}
