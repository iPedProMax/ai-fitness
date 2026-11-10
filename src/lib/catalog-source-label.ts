/** Presentation-only labels for the server's known catalog provenance. */
export function catalogSourceLabel(source: unknown): string {
  if (source === "Khalories Philippine Food Library") return "Khalories Philippine Food Library";
  if (typeof source === "string" && source.startsWith("Open Food Facts PH-tagged community")) {
    return "PH community catalog";
  }
  if (source === "Community barcode nutrition cross-reference") return "Community barcode reference";
  if (source === "Open Food Facts") return "Open Food Facts";
  return "Food catalog";
}
