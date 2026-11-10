import type { CatalogFood } from "./open-food-facts";

/** ODbL community records; never label these as independently reviewed. */
const EXPECTED = ["barcode", "product_name", "brand", "calories_100g", "protein_100g", "carbs_100g", "fat_100g", "license", "source_url"] as const;

export function parseCommunityCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cell = "", cells: string[] = [], quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { cells.push(cell); cell = ""; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      cells.push(cell); cell = "";
      if (cells.some(x => x.trim())) rows.push(cells);
      cells = [];
    } else cell += c;
  }
  if (quoted) throw new Error("Unterminated community CSV field");
  if (cells.length || cell) { cells.push(cell); rows.push(cells); }
  const [rawHeader, ...data] = rows;
  const header = rawHeader?.map(x => x.replace(/^\uFEFF/, "").trim()) ?? [];
  if (!EXPECTED.every(key => header.includes(key))) throw new Error("Unexpected Philippine dataset columns");
  if (data.length > 5000) throw new Error("Philippine dataset exceeds local limit");
  return data.map(cells => Object.fromEntries(header.map((key, i) => [key, (cells[i] ?? "").trim()])));
}
function nutrient(raw: string | undefined, max: number): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export function toCommunityFood(row: Record<string, string>): CatalogFood | null {
  const barcode = row.barcode ?? "";
  const name = (row.product_name ?? "").trim().slice(0, 110);
  if (!/^\d{8,14}$/.test(barcode) || name.length < 2 || row.license !== "ODbL 1.0") return null;
  const advanced = {
    ...(nutrient(row.fiber_100g, 100) !== null ? { fiberG: nutrient(row.fiber_100g, 100)! } : {}),
    ...(nutrient(row.sugar_100g, 100) !== null ? { sugarG: nutrient(row.sugar_100g, 100)! } : {}),
    ...(nutrient(row.sodium_mg_100g, 100000) !== null ? { sodiumMg: nutrient(row.sodium_mg_100g, 100000)! } : {}),
    ...(nutrient(row.cholesterol_mg_100g, 100000) !== null ? { cholesterolMg: nutrient(row.cholesterol_mg_100g, 100000)! } : {}),
    ...(nutrient(row.potassium_mg_100g, 100000) !== null ? { potassiumMg: nutrient(row.potassium_mg_100g, 100000)! } : {}),
    ...(nutrient(row.calcium_mg_100g, 100000) !== null ? { calciumMg: nutrient(row.calcium_mg_100g, 100000)! } : {}),
    ...(nutrient(row.iron_mg_100g, 100000) !== null ? { ironMg: nutrient(row.iron_mg_100g, 100000)! } : {}),
    ...(nutrient(row.vitamin_d_mcg_100g, 1000) !== null ? { vitaminDMcg: nutrient(row.vitamin_d_mcg_100g, 1000)! } : {}),
  };
  return {
    barcode, name, brand: (row.brand ?? "").slice(0, 80),
    servingDescription: (row.serving_size ?? "").slice(0, 80),
    packageDescription: (row.package_quantity ?? "").slice(0, 80),
    calories100g: nutrient(row.calories_100g, 2000),
    protein100g: nutrient(row.protein_100g, 100),
    carbs100g: nutrient(row.carbs_100g, 100),
    fat100g: nutrient(row.fat_100g, 100),
    ...(Object.keys(advanced).length ? { advancedNutrients100g: advanced } : {}),
  };
}
export type PhCommunityRecord = { food: CatalogFood; category: string; priority: number; sourceUrl: string };
export function buildCommunityIndex(csv: string): PhCommunityRecord[] {
  const seen = new Set<string>();
  const result: PhCommunityRecord[] = [];
  for (const row of parseCommunityCsv(csv)) {
    const food = toCommunityFood(row);
    if (!food || seen.has(food.barcode)) continue;
    seen.add(food.barcode);
    result.push({
      food, category: (row.category ?? "").slice(0, 110),
      priority: Math.max(0, Math.min(9999, Number(row.priority_score) || 0)),
      sourceUrl: /^https:\/\/world\.openfoodfacts\.org\/product\/\d{8,14}$/.test(row.source_url ?? "") ? row.source_url : "https://world.openfoodfacts.org/",
    });
  }
  return result;
}
export function searchCommunityIndex(data: readonly PhCommunityRecord[], kind: "barcode" | "search", value: string): CatalogFood[] {
  const term = value.toLocaleLowerCase().trim();
  if (kind === "barcode") return data.filter(record => record.food.barcode === term).slice(0, 1).map(record => record.food);
  const tokens = term.split(/\s+/).filter(Boolean);
  if (tokens.join("").length < 3 || tokens.length > 8) return [];
  return data.map(record => {
    const f = record.food;
    const hay = `${f.name} ${f.brand} ${record.category}`.toLocaleLowerCase();
    const matches = tokens.every(token => hay.includes(token));
    const complete = [f.calories100g, f.protein100g, f.carbs100g, f.fat100g].every(v => v !== null);
    const relevance = f.name.toLocaleLowerCase().includes(term) ? 100 : hay.includes(term) ? 40 : 0;
    return { record, score: matches ? relevance + (complete ? 12 : 0) + Math.min(30, record.priority) : -1 };
  }).filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.record.food.name.localeCompare(b.record.food.name))
    .slice(0, 8).map(x => x.record.food);
}
