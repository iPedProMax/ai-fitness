/** Validate input without sending unnecessary Gemini requests. */
export function validateFoodText(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("description" in body)) return null;
  const description = (body as { description?: unknown }).description;
  if (typeof description !== "string") return null;
  const trimmed = description.trim();
  return trimmed.length >= 3 && trimmed.length <= 600 ? trimmed : null;
}

