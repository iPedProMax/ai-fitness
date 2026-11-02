/** Format a Manila calendar day without combining dateStyle with component options. */
export function formatReportDate(dateKey: string): string {
  const day = new Date(`${dateKey}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(day);
}
