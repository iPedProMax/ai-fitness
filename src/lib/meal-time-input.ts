export function localDateString(
  date: Date
): string {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function localMealTimeToIso(
  dateInput: string,
  timeInput: string,
  now: Date = new Date()
): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateInput) ||
    !/^\d{2}:\d{2}$/.test(timeInput)
  ) {
    return null;
  }

  const [year, month, day] =
    dateInput.split("-").map(Number);

  const [hour, minute] =
    timeInput.split(":").map(Number);

  const parsed = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  if (
    parsed.getTime() >
    now.getTime() + 5 * 60 * 1000
  ) {
    return null;
  }

  return parsed.toISOString();
}