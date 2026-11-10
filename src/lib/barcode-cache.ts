import type { CatalogFood } from "@/lib/open-food-facts";
/** Browser-local cache. Public product metadata only; never photos, prompts or account information. */
export const BARCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = "ai-fitness-off-v1:";
export type CachedCatalog = { foods: CatalogFood[]; fetchedAt: number };
export function catalogCacheKey(kind: "barcode" | "q", value: string): string {
  return PREFIX + kind + ":" + value.toLowerCase().trim().slice(0,60);
}
export function parseCachedCatalog(raw: string | null, now = Date.now()): CachedCatalog | null {
  if (!raw || raw.length > 50000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.fetchedAt !== "number" || !Number.isFinite(obj.fetchedAt) ||
      obj.fetchedAt > now || now - obj.fetchedAt > BARCODE_CACHE_TTL_MS || !Array.isArray(obj.foods) || obj.foods.length > 8) return null;
    const foods = obj.foods as unknown[];
    if (!foods.every(food => food && typeof food === "object" &&
      typeof (food as CatalogFood).barcode === "string" && typeof (food as CatalogFood).name === "string")) return null;
    return { foods: foods as CatalogFood[], fetchedAt: obj.fetchedAt };
  } catch { return null; }
}
export function readCatalogCache(kind: "barcode" | "q", value: string): CachedCatalog | null {
  try { return parseCachedCatalog(window.localStorage.getItem(catalogCacheKey(kind,value))); } catch { return null; }
}
export function saveCatalogCache(kind: "barcode" | "q", value: string, foods: CatalogFood[]): void {
  if (!foods.length || foods.length > 8) return; // Never preserve "not found" indefinitely.
  try {
    const storage = window.localStorage;
    const key = catalogCacheKey(kind,value);
    storage.setItem(key, JSON.stringify({foods,fetchedAt:Date.now()}));
    // Bound on-device storage. Only delete keys from this application's namespace.
    const keys = Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>Boolean(key?.startsWith(PREFIX)));
    if (keys.length > 45) for (const old of keys.slice(0,keys.length-45)) if(old !== key) storage.removeItem(old);
  } catch { /* Private mode or quota exhaustion: lookups still work */ }
}
