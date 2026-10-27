/** Examples support the actual clarification question; they are not pre-filled answers. */
export type ClarificationAnswerPrompt = {
  id: string;
  question: string;
  options: string[];
};

type InputCopy = { placeholder: string; helper: string };

function optionExamples(options: readonly string[]): string | null {
  const meaningful = options
    .map((option) => option.trim())
    .filter((option) => option.length > 0 &&
      !/^(?:i (?:don't|do not) know|not sure|unsure|unknown|skip|other(?: \/ type it)?|none of the above)$/i.test(option))
    .slice(0, 2);
  if (meaningful.length === 0) return null;
  return `e.g. ${meaningful.join(" or ")}`;
}

export function getClarificationAnswerCopy(clarification: ClarificationAnswerPrompt): InputCopy {
  const question = clarification.question.toLowerCase();
  const id = clarification.id;

  if (/^brand_\d+$/.test(id) || /\bbrand\b|\bexact product\b|\bmanufacturer\b/.test(question)) {
    return {
      placeholder: /\b(oat|oats|oatmeal)\b/.test(question)
        ? "e.g. Quaker Quick Cook Oats"
        : "e.g. the brand and exact product name",
      helper: "Enter the brand or full product name, if you know it.",
    };
  }

  if (/\bhow much\b|\bwhat amount\b|\bquantity\b|\bhow many\b|\b(grams?|teaspoons?|tablespoons?|milliliters?|millilitres?)\b/.test(question) || /(?:_amount|_quantity)(?:_|$)/.test(id)) {
    return {
      placeholder: optionExamples(clarification.options) ?? "e.g. 2 teaspoons, 10 g, or half a tablespoon",
      helper: "Enter the amount and unit if known (e.g. 2 tsp or 10 g).",
    };
  }

  if (/^variety_\d+$/.test(id) || /\bvariety\b|\btype of\b/.test(question) && !/\b(meat|protein|ingredient)\b/.test(question)) {
    return {
      placeholder: optionExamples(clarification.options) ?? "e.g. the specific type or variety",
      helper: "Enter the variety or type as precisely as you know it.",
    };
  }

  if (/\b(meat|protein|ingredient|ingredients|added|additions|filling)\b/.test(question)) {
    return {
      placeholder: optionExamples(clarification.options) ?? "e.g. chicken, pork, or added sugar",
      helper: "Describe the ingredient or addition you know is present.",
    };
  }

  if (/\b(cooked|prepared|cooking|preparation|method)\b/.test(question)) {
    return {
      placeholder: optionExamples(clarification.options) ?? "e.g. boiled, fried, or steamed",
      helper: "Describe how the food or drink was prepared.",
    };
  }

  return {
    placeholder: optionExamples(clarification.options) ?? "Type your answer here",
    helper: "Answer the question in your own words.",
  };
}
