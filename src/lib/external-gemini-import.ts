import { makeManualFoodAnalysis, type ManualFoodInput } from "@/lib/manual-food";

/** Human-mediated imports: no external AI service is contacted by this module. */
export const EXTERNAL_AI_SITES = [
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/", note: "Google account and upload limits may apply." },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", note: "Photo uploads depend on plan and usage limits." },
  { id: "grok", name: "Grok", url: "https://grok.com/", note: "Upload availability and usage limits vary by account." },
  { id: "claude", name: "Claude", url: "https://claude.ai/", note: "Photo uploads depend on account and plan limits." },
  { id: "copilot", name: "Microsoft Copilot", url: "https://copilot.microsoft.com/", note: "Image upload support may depend on your account." },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/", note: "Check whether image upload is available in its current web chat; API Vision support does not guarantee it." },
  { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/", note: "Image upload availability depends on plan and product interface." },
] as const;

export type ExternalAiSiteId = (typeof EXTERNAL_AI_SITES)[number]["id"];
export type ExternalFoodImport = { items: ManualFoodInput[]; notes: string };

export const EXTERNAL_WEB_FOOD_PROMPT = `Analyze the food photo(s) I upload for meal logging. Please give a simple, human-readable nutrition summary — NOT JSON and no code block needed.
For each food, write a separate section starting with "Food: [name]" and then labeled lines such as:
Calories: [number] kcal
Protein: [number] g
Carbs: [number] g
Fat: [number] g
Serving weight: [number] g (ONLY when actual net edible weight is confirmed)
Advanced nutrition when supported: Fiber (g), Total sugar (g), Saturated fat (g), Added sugar (g), Sodium (mg), Cholesterol (mg), Potassium (mg), Calcium (mg), Iron (mg), Vitamin D (mcg; vitaminDMcg).
Values must be for the CONSUMED portion, not per 100 g. If a digital scale shows a container, ask if it was tared; do not assume scale reading is net food weight. If tare is unknown, leave serving weight unknown. Use readable labels or a two-column table; Khalories can import both.
Prioritize actual readable packaging/label data over guesses. Clearly identify uncertainty. Write "Unknown" for missing nutrients — never use 0 unless you have evidence it is truly zero. Do not invent brand, measurements, or vitamin/mineral values. Up to 10 foods. I'll review and correct all values in Khalories before saving.`;
// Backward-compatible export retained for Q4.13A regression tests and existing imports.
export const GEMINI_WEB_FOOD_PROMPT = EXTERNAL_WEB_FOOD_PROMPT;

export const ADVANCED_NUTRIENT_FIELDS = [
  ["fiberG", "Fiber (g)"],
  ["sugarG", "Total sugar (g)"],
  ["saturatedFatG", "Saturated fat (g)"],
  ["addedSugarG", "Added sugar (g)"],
  ["sodiumMg", "Sodium (mg)"],
  ["cholesterolMg", "Cholesterol (mg)"],
  ["potassiumMg", "Potassium (mg)"],
  ["calciumMg", "Calcium (mg)"],
  ["ironMg", "Iron (mg)"],
  ["vitaminDMcg", "Vitamin D (mcg)"],
] as const satisfies ReadonlyArray<readonly [keyof ManualFoodInput, string]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueToInput(value: unknown, label: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} must be a number or null.`);
  }
  const text = String(value).trim();
  if (!text) return "";
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`${label} must be a non-negative number without units, or null.`);
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 100000) {
    throw new Error(`${label} must be a realistic non-negative number.`);
  }
  return text;
}

function jsonPayload(paste: string): string {
  const input = paste.trim();
  if (!input || input.length > 30000) throw new Error("Paste a JSON nutrition result (maximum 30,000 characters).");
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(input);
  return fenced ? fenced[1].trim() : input;
}

export function parseExternalFoodImport(paste: string): ExternalFoodImport {
  let data: unknown;
  try { data = JSON.parse(jsonPayload(paste)); }
  catch { throw new Error("The AI response must be valid JSON. Ask it to return ONLY a JSON object and copy its response again."); }
  if (!isObject(data) || !Array.isArray(data.foods) || data.foods.length === 0 || data.foods.length > 10) {
    throw new Error("The reply must include 1–10 foods in a JSON foods array.");
  }
  const items = data.foods.map((food: unknown, index: number): ManualFoodInput => {
    if (!isObject(food) || typeof food.name !== "string" || !food.name.trim() || food.name.length > 120) {
      throw new Error(`Food ${index + 1} needs a valid name (up to 120 characters).`);
    }
    // Some sites return secondary nutrients under advancedNutrients; support either location.
    const nested = isObject(food.advancedNutrients) ? food.advancedNutrients : {};
    const item: ManualFoodInput = {
      name: food.name.trim(),
      grams: valueToInput(food.grams ?? food.estimatedGrams, "Serving weight"),
      calories: valueToInput(food.calories, "Calories"),
      protein: valueToInput(food.protein, "Protein"),
      carbs: valueToInput(food.carbs ?? food.carbohydrates, "Carbohydrates"),
      fat: valueToInput(food.fat, "Fat"),
    };
    for (const [key, label] of ADVANCED_NUTRIENT_FIELDS) {
      item[key] = valueToInput(food[key] ?? nested[key], label);
    }
    return item;
  });
  const notes = typeof data.notes === "string" ? data.notes.trim().slice(0, 700) : "";
  return { items, notes };
}

export function makeReviewedExternalFoodAnalysis(imported: ExternalFoodImport, siteId: ExternalAiSiteId = "gemini") {
  const site = EXTERNAL_AI_SITES.find(s => s.id === siteId);
  if (!site) throw new Error("Unrecognized external AI website.");
  // This is the existing manual-food route; advanced nutrients survive in its schema.
  const manual = makeManualFoodAnalysis(imported.items);
  return {
    ...manual,
    entryMethod: "MANUAL" as const,
    notes: [
      `Externally generated ${site.name} nutrition estimate imported by the user and reviewed in Khalories. No Khalories AI scan was performed. Values are user-reviewed, not independently verified.`,
      imported.notes,
    ].filter(Boolean).join(" ").slice(0, 1400),
  };
}
