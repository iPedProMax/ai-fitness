/** Local preflight clarifications: no API request or quota debit is made here. */
export type PortionKind = "dab" | "spoonful" | "handful" | "splash" | "pinch" | "general";
export type PortionScope = "total" | "each";
export type PortionAnswer = { amount: string; scope?: PortionScope };
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

export function canSubmitPortionAnswers(questions: readonly PortionQuestion[], answers: Record<string, PortionAnswer>): boolean {
  return questions.length > 0 && questions.every(question => {
    const answer = answers[question.id];
    if (!answer) return false;
    const amount = answer.amount.trim();
    if (amount === "UNKNOWN") return true;
    return amount.length >= 2 && amount.length <= 90 && (answer.scope === "total" || answer.scope === "each");
  });
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
    const scope = answer.scope === "each" ? "per described item" : "for the whole meal";
    return `${question.phrase}: ${value} ${scope}`;
  }).join("; ");
  const prompt = `${description.trim()}\nUser-confirmed portion details (approximate; volume is not weight): ${details}`;
  if (prompt.length > 600) throw new Error("The description plus portion details exceeds 600 characters. Shorten your meal description and try again.");
  return prompt;
}