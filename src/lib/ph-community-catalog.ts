import "server-only";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CatalogFood } from "./open-food-facts";
import { buildCommunityIndex, searchCommunityIndex, type PhCommunityRecord } from "./ph-community-parser";

const file = join(process.cwd(), "data", "khalories-ph-community.csv");
let cache: { mtime: number; records: PhCommunityRecord[] } | null = null;
/** Reads an independently stored ODbL dataset. No network or AI credit required. */
export function findPhCommunityFood(kind: "barcode" | "search", value: string): CatalogFood[] {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return []; // Keep mocked API tests deterministic.
  try {
    const stats = statSync(file);
    if (!stats.isFile() || stats.size > 6_000_000) return [];
    if (cache?.mtime !== stats.mtimeMs) {
      cache = { mtime: stats.mtimeMs, records: buildCommunityIndex(readFileSync(file, "utf8")) };
    }
    return searchCommunityIndex(cache.records, kind, value);
  } catch {
    // Missing/corrupt local dataset is not an authentication or Open Food Facts error.
    return [];
  }
}
