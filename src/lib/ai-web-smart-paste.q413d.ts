import type { ManualFoodInput } from "@/lib/manual-food";
import {
  parseExternalFoodImport,
  type ExternalFoodImport,
} from "@/lib/external-gemini-import";

export type SmartPasteResult = ExternalFoodImport & {
  format: "json" | "plain-text";
  warnings: string[];
};

type NumericKey = Exclude<keyof ManualFoodInput, "name">;
type MatchRule = { key: NumericKey; label: RegExp; unit: "g" | "mg" | "mcg" | "kcal" };

const RULES: MatchRule[] = [
  { key: "grams", label: /^(?:net\s+(?:food\s+)?weight|edible\s+(?:portion|weight)|serving\s+(?:size|weight)|portion\s+(?:size|weight)|consumed\s+(?:portion|weight)|(?:net\s+)?grams?)$/i, unit: "g" },
  { key: "calories", label: /^(?:calories?|energy(?:\s*\(?kcal\)?)?|kcal)$/i, unit: "kcal" },
  { key: "protein", label: /^(?:protein|proteins)$/i, unit: "g" },
  { key: "carbs", label: /^(?:carbs?|carbohydrates?|total\s+carbohydrates?)$/i, unit: "g" },
  { key: "fat", label: /^(?:fat|total\s+fat|fats?)$/i, unit: "g" },
  { key: "fiberG", label: /^(?:(?:dietary\s+)?fib(?:er|re))$/i, unit: "g" },
  { key: "sugarG", label: /^(?:total\s+)?sugars?$/i, unit: "g" },
  { key: "saturatedFatG", label: /^(?:saturated\s+fat|sat\.?\s*fat)$/i, unit: "g" },
  { key: "addedSugarG", label: /^(?:added\s+sugars?)$/i, unit: "g" },
  { key: "sodiumMg", label: /^(?:sodium)$/i, unit: "mg" },
  { key: "cholesterolMg", label: /^(?:cholesterol)$/i, unit: "mg" },
  { key: "potassiumMg", label: /^(?:potassium)$/i, unit: "mg" },
  { key: "calciumMg", label: /^(?:calcium)$/i, unit: "mg" },
  { key: "ironMg", label: /^(?:iron)$/i, unit: "mg" },
  { key: "vitaminDMcg", label: /^(?:vitamin\s*d)$/i, unit: "mcg" },
];

const MAX_PASTE = 30000;
const RANGE_RX = /(?:^|\s)(?:\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?/i;
const SCALE_UNCERTAIN_RX = /(?:tare\s+(?:status\s+)?(?:unknown|unclear|unconfirmed|not\s+confirmed|unsure)|not\s+tared|without\s+(?:confirmed\s+)?tare|(?:container|bowl|plate|wrap|packaging)\s+(?:included|present|on\s+(?:the\s+)?scale)|(?:weight|reading)\s+(?:includes|may\s+include)\s+(?:the\s+)?(?:bowl|container|plate|wrap)|cannot\s+(?:confirm|determine)\s+(?:the\s+)?(?:net\s+)?(?:food\s+)?weight|(?:weight|scale\s+reading)\s+(?:is\s+)?not\s+(?:confirmed|the\s+net))/i;

function sanitizePaste(raw: string): string {
  if (!raw.trim() || raw.length > MAX_PASTE) throw new Error("Paste a nutrition answer (maximum 30,000 characters).");
  return raw
    .replace(/&#(?:x20|32);|&nbsp;/gi, " ")
    .replace(/\u00a0|\u200b|\ufeff/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function maybeJson(text: string): string | null {
  const block = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (block?.[1]?.trim().startsWith("{")) return block[1].trim();
  if (text.startsWith("{")) return text;
  // Some AI websites add "Here you go" around a valid JSON object.
  const beginning = text.indexOf('{"foods"');
  if (beginning >= 0) {
    const last = text.lastIndexOf("}");
    if (last > beginning) return text.slice(beginning, last + 1);
  }
  return null;
}

function stripLine(line: string): string {
  let cleaned = line.trim().replace(/^\s*(?:[-*•]\s+|\d+\.\s+)/, "");
  cleaned = cleaned.replace(/\*\*|__|`/g, "").trim();
  if (cleaned.startsWith("|") && cleaned.endsWith("|")) {
    const parts = cleaned.slice(1, -1).split("|").map(s => s.trim());
    if (parts.length === 2) cleaned = `${parts[0]}: ${parts[1]}`;
  }
  return cleaned;
}

function readPair(line: string): { key: string; value: string } | null {
  const clean = stripLine(line);
  // Treat a separated nutrition table exactly like labeled text.
  const pair = /^([^:=|\n]{1,55})\s*(?::|=|\s+[–—-]\s+)\s*(.+)$/.exec(clean);
  if (pair) return { key: pair[1].trim().replace(/\s*\([^)]*\)\s*$/, "").trim(), value: pair[2].trim() };
  const table = /^([^|]{1,55})\|\s*(.+)$/.exec(clean);
  if (table) return { key: table[1].trim(), value: table[2].trim() };
  return null;
}

function readNumber(text: string, unit: MatchRule["unit"]): string | null {
  const trimmed = text.trim().replace(/^\*+|\*+$/g, "").trim();
  if (/^(?:unknown|n\/?a|not\s+(?:known|available|provided|specified|determined)|null|—|-)\b/i.test(trimmed)) return null;
  if (RANGE_RX.test(trimmed)) return null;
  const found = /^(?:(?:about|approximately|approx\.?|estimated|roughly|around)\s*)?(?:~|≈)?\s*([0-9]{1,6}(?:\.[0-9]{1,3})?)\s*(kcal|calories|g|grams?|mg|mcg|µg|ug|iu|kj)?(?=$|\s|[,.;()])/i.exec(trimmed);
  if (!found) return null;
  const amount = Number(found[1]);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return null;
  const written = (found[2] ?? "").toLowerCase();
  const valid = unit === "kcal" ? ["", "kcal", "calories"] : unit === "g" ? ["", "g", "gram", "grams"] : unit === "mg" ? ["", "mg"] : ["", "mcg", "µg", "ug"];
  if (!valid.includes(written)) return null;
  // Do not treat "70.6 g before removing the bowl" as confirmed net food weight.
  if (unit === "g" && /(?:bowl|container|wrap|packaging)\s+(?:not\s+)?(?:removed|tared|included)/i.test(trimmed)) return null;
  return String(amount);
}

function initialFood(): ManualFoodInput {
  return { name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" };
}

function parsePlainText(text: string): SmartPasteResult {
  const normalized = text.replace(/```(?:text|markdown)?\s*|```/gi, "");
  const lines = normalized.split("\n");
  const sectionStarts = lines.map((line, i) => (/^\s*(?:#{1,4}\s*)?(?:\*\*)?food\s*\d{1,2}\s*[:—-]\s*(.+)/i.test(line) ? i : -1)).filter(i => i >= 0);
  const groups = sectionStarts.length > 1 ? sectionStarts.map((start, i) => lines.slice(start, sectionStarts[i + 1] ?? lines.length)) : [lines];
  if (groups.length > 10) throw new Error("Import up to ten foods at once.");
  const per100g = /\b(?:nutrition(?:\s+values?)?\s+)?per\s+100\s*(?:g|grams?)\b/i.test(normalized) && !/\b(?:not|instead\s+of|rather\s+than)\s+per\s+100\s*(?:g|grams?)\b/i.test(normalized);
  const tareUncertain = SCALE_UNCERTAIN_RX.test(normalized) || /\b(?:scale|weighing)\s+(?:reads|shows|displayed?)\b[^\n]{0,120}\b(?:bowl|container|wrap|plate)\b/i.test(normalized);
  const warnings: string[] = [];
  if (per100g) warnings.push("The answer mentions per-100 g values. They were not applied as consumed-serving nutrition; confirm a portion and choose a reference.");
  if (tareUncertain) warnings.push("A container or uncertain tare was mentioned. Scale readings were not imported as confirmed net serving weight.");
  const items: ManualFoodInput[] = [];
  for (const group of groups) {
    const item = initialFood();
    const segment = group.join("\n");
    let foundNumericLine = false;
    for (const rawLine of group) {
      const line = stripLine(rawLine);
      const foodHeading = /^food\s*\d{1,2}\s*[:—-]\s*(.+)$/i.exec(line);
      if (foodHeading) { item.name = foodHeading[1].replace(/\*+$/, "").trim().slice(0, 120); continue; }
      const pair = readPair(rawLine);
      if (pair) {
        if (/^(?:food\s*(?:name|item)?|name|item|dish)$/i.test(pair.key)) {
          if (!item.name) item.name = pair.value.replace(/[.]+$/, "").trim().slice(0, 120);
          continue;
        }
        const rule = RULES.find(r => r.label.test(pair.key));
        if (rule) {
          foundNumericLine = true;
          if (per100g && rule.key !== "grams") continue;
          if (rule.key === "grams" && tareUncertain && !/\b(?:net\s+(?:food\s+)?weight|edible\s+(?:portion|weight))\b/i.test(pair.key)) continue;
          const value = readNumber(pair.value, rule.unit);
          if (value !== null) item[rule.key] = value;
          continue;
        }
      }
      if (!item.name && /^(?:#{1,4}\s+|\*\*)(.{3,110}?)(?:\*\*)?\s*$/.test(rawLine) && !/^(?:estimated|nutrition|calories|protein|macros|food\s+analysis)/i.test(line)) {
        item.name = line.replace(/^#+\s*/, "").trim().slice(0, 120);
      }
    }
    // Also accept simple prose like "About 265 kcal, 9 g protein and 47 g carbs".
    // Unit and macro labels must be adjacent; no inference from unlabeled numbers.
    if (!per100g) {
      if (!item.calories) {
        const kcal = /\b([0-9]{1,5}(?:\.[0-9]{1,3})?)\s*kcal\b/i.exec(segment);
        if (kcal && !RANGE_RX.test(segment.slice(Math.max(0, kcal.index - 7), kcal.index + kcal[0].length))) item.calories = String(Number(kcal[1]));
      }
      const inlineMacros: Array<{key:"protein"|"carbs"|"fat"; word:string}> = [
        {key:"protein",word:"proteins?"}, {key:"carbs",word:"(?:carbs?|carbohydrates?)"}, {key:"fat",word:"(?:total\\s+)?fat"},
      ];
      for (const macro of inlineMacros) {
        if (item[macro.key]) continue;
        const unitFirst = new RegExp(`\\b([0-9]{1,5}(?:\\.[0-9]{1,3})?)\\s*g\\s*(?:of\\s+)?${macro.word}\\b`, "i").exec(segment);
        const labelFirst = new RegExp(`\\b${macro.word}\\s*(?::|is|about|\\u2248|~)\\s*([0-9]{1,5}(?:\\.[0-9]{1,3})?)\\s*g\\b`, "i").exec(segment);
        const found = unitFirst ?? labelFirst;
        if (found && !RANGE_RX.test(segment.slice(Math.max(0, found.index - 7), found.index + found[0].length))) item[macro.key] = String(Number(found[1]));
      }
    }
    if (!item.name) {
      const candidate = /\b(?:looks?\s+like|appears?\s+to\s+be|food\s+(?:is|shown\s+is)|identified\s+as)\s+(?:some\s+|a\s+|an\s+)?([^,.!\n:]{3,75})/i.exec(segment);
      if (candidate) item.name = candidate[1].replace(/\s+(?:on|in|with|but|and|from|at)\b.*$/i, "").trim().slice(0, 120);
    }
    if (!item.name && !foundNumericLine) continue;
    if (!item.name) warnings.push("A food name was not recognized. Enter the food name manually before saving.");
    items.push(item);
  }
  if (items.length < 1) throw new Error("No recognizable food or nutrition labels found. Paste a reply with 'Food: ...', 'Calories: ...', etc., or use the manual editor.");
  if (!items.some(item => item.calories || item.protein || item.carbs || item.fat)) {
    warnings.push("No reliable calories or macros were found. Confirm the serving and use Smart Nutrition Autofill below, or enter the missing values manually.");
  }
  return { items, notes: warnings.join(" ").slice(0, 700), format: "plain-text", warnings };
}

/** Parse locally; never sends the pasted chat or images to any AI provider. */
export function parseSmartWebFoodPaste(paste: string): SmartPasteResult {
  const normalized = sanitizePaste(paste);
  const candidate = maybeJson(normalized);
  if (candidate) {
    try {
      const imported = parseExternalFoodImport(candidate);
      return { ...imported, format: "json", warnings: [] };
    } catch (issue) {
      // An incomplete JSON answer should not be reinterpreted into random numerical fields.
      throw new Error(issue instanceof Error ? `${issue.message} You can also paste a regular nutrition summary instead of JSON.` : "Couldn't read the structured answer. Paste a normal nutrition summary instead.");
    }
  }
  return parsePlainText(normalized);
}
