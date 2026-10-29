/** Local preflight clarifications: no API request or quota debit is made here. */
export type PortionKind = "dab" | "spoonful" | "handful" | "splash" | "pinch" | "general";
export type PortionScope = "total" | "each";
export type PortionAnswer = { amount: string; scope?: PortionScope; eachCount?: string };
export type PortionQuestion = {
  id: string;
  phrase: string;
  kind: PortionKind;
  examples: readonly string[];
};

const VAGUE_AMOUNT = /\b(?:dabs?|spoonfuls?|handfuls?|splashes?|pinches?|a\s+little|a\s+few|small\s+amount)\b/gi;
const MEASURED_AFTER = /^\s*(?:\(\s*|[=:]\s*|,\s*)\d+(?:\.\d+)?\s*(?:g|grams?|kg|ml|milliliters?|tsp|teaspoons?|tbsp|tablespoons?|cups?)\b/i;

function kindFor(phrase: string): PortionKind {
  if (/^dabs?$/i.test(phrase)) return "dab";
  if (/^spoonfuls?$/i.test(phrase)) return "spoonful";
  if (/^handfuls?$/i.test(phrase)) return "handful";
  if (/^splashes?$/i.test(phrase)) return "splash";
  if (/^pinches?$/i.test(phrase)) return "pinch";
  return "general";
}

const EXAMPLES: Record<PortionKind, readonly string[]> = {
  dab: ["About 1/4 tsp (1.25 mL)", "About 1/2 tsp (2.5 mL)", "About 1 tsp (5 mL)"],
  spoonful: ["About 1 tsp (5 mL)", "About 1 tbsp (15 mL)", "About 2 tbsp (30 mL)"],
  handful: ["A small handful", "A medium handful", "A large handful"],
  splash: ["About 1 tsp (5 mL)", "About 1 tbsp (15 mL)", "About 2 tbsp (30 mL)"],
  pinch: ["About 1/8 tsp (0.6 mL)", "About 1/4 tsp (1.25 mL)", "About 1/2 tsp (2.5 mL)"],
  general: [],
};

/** Explicit nearby measurements like "a dab (5 g)" don't trigger duplicate questions. */
export function findPortionQuestions(description: string): PortionQuestion[] {
  const found: PortionQuestion[] = [];
  for (const match of description.matchAll(VAGUE_AMOUNT)) {
    const phrase = match[0];
    const index = match.index;
    if (MEASURED_AFTER.test(description.slice(index + phrase.length))) continue;
    const kind = kindFor(phrase);
    found.push({ id: `portion-${index}`, phrase, kind, examples: EXAMPLES[kind] });
  }
  return found;
}

/** Reject unsupported free text instead of passing made-up measurements to AI. */
function validAmount(amount: string, question: PortionQuestion): boolean {
  if (question.examples.includes(amount)) return true;
  // Custom amounts require a positive measured quantity and a real unit.
  const numeric = amount.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(g|grams?|kg|mL|milliliters?|tsp|teaspoons?|tbsp|tablespoons?|cups?|pieces?|slices?|crackers?)$/i);
  if (!numeric) return false;
  const number = numeric[1].includes("/")
    ? Number(numeric[1].split("/")[0]) / Number(numeric[1].split("/")[1])
    : Number(numeric[1]);
  return Number.isFinite(number) && number > 0 && number <= 10000;
}

function validCount(count: string | undefined): boolean {
  return typeof count === "string" && /^[1-9]\d{0,2}$/.test(count.trim()) && Number(count.trim()) <= 100;
}

export function canSubmitPortionAnswers(questions: readonly PortionQuestion[], answers: Record<string, PortionAnswer>): boolean {
  return questions.length > 0 && questions.every(question => {
    const answer = answers[question.id];
    if (!answer) return false;
    const amount = answer.amount.trim();
    if (amount === "UNKNOWN") return true;
    if (!validAmount(amount, question)) return false;
    if (answer.scope === "total") return true;
    return answer.scope === "each" && validCount(answer.eachCount);
  });
}

/** Multiplication works for volumes and weights, not a nutrition-density claim. */
function statedTotal(amount: string, count: number): string {
  const explicitVolume = amount.match(/\(\s*(\d+(?:\.\d+)?)\s*mL\s*\)/i);
  let magnitude: number;
  let unit: string;
  if (explicitVolume) {
    magnitude = Number(explicitVolume[1]);
    unit = "mL";
  } else {
    const measured = amount.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(g|grams?|kg|mL|milliliters?|tsp|teaspoons?|tbsp|tablespoons?|cups?)$/i);
    if (!measured) return "";
    magnitude = measured[1].includes("/")
      ? Number(measured[1].split("/")[0]) / Number(measured[1].split("/")[1])
      : Number(measured[1]);
    unit = measured[2];
  }
  const total = Math.round(magnitude * count * 100) / 100;
  return `; calculated total: ${total} ${unit} across all ${count} items (do not multiply again)`;
}

/** Adds user-supplied context; never converts a spoon-volume into food grams. */
export function makeClarifiedPortionPrompt(
  description: string,
  questions: readonly PortionQuestion[],
  answers: Record<string, PortionAnswer>,
): string {
  if (!canSubmitPortionAnswers(questions, answers)) throw new Error("Please clarify each vague amount, or select Not sure.");
  const details = questions.map(question => {
    const answer = answers[question.id];
    if (answer.amount.trim() === "UNKNOWN") return `${question.phrase}: quantity unknown; state assumptions`;
    const value = answer.amount.trim().replace(/\s+/g, " ");
    if (answer.scope === "each") {
      const count = Number(answer.eachCount);
      // Explicit count matters: 1 tsp on EACH of 4 crackers is not 1 tsp total.
      return `${question.phrase}: ${value} for each of exactly ${count} described items` + statedTotal(value, count);
    }
    return `${question.phrase}: ${value} for the whole meal (total amount, do not multiply)`;
  }).join("; ");
  const prompt = `${description.trim()}\nUser-confirmed portion details (approximate; volume is not weight): ${details}`;
  if (prompt.length > 600) throw new Error("The description plus portion details exceeds 600 characters. Shorten your meal description and try again.");
  return prompt;
}