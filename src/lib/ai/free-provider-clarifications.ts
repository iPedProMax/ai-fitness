import type { FoodAnalysis } from "@/lib/food-analysis";

/**
 * Suppress only questions that cannot improve a label-backed prepared drink.
 * This is called for Groq / Cloudflare, NOT Gemini.
 * Keep questions about amounts, ingredients, and additions that can change nutrition.
 */
export function pruneFreeProviderClarifications(
  analysis: FoodAnalysis
): FoodAnalysis {
  const isDrink = (name: string, state: string | undefined) =>
    state === "OPEN_PREPARED" ||
    state === "SEALED_PACKAGED" ||
    /\b(drink|tea|coffee|juice|lemonade|smoothie|shake|beverage|mocktail)\b/i.test(name);

  const clarifications = analysis.clarifications.filter((item) => {
    const food = analysis.foods[item.foodIndex];
    if (!food || !isDrink(food.name, food.preparationState)) {
      return true;
    }

    const question = item.question.toLowerCase();

    // A preparation using the same sachet and plain water does not add energy.
    // Do NOT remove questions about number of sachets or amount consumed.
    const waterVsPowder =
      /\b(powder|sachet)\b/.test(question) &&
      /\bwater\b/.test(question) &&
      /\b(whole|entire|just|only)\b/.test(question) &&
      /\b(consum(?:e|ing)|drink(?:ing)?)\b/.test(question) &&
      !/\b(how many|how much|number|quantity|multiple|two|three)\b/.test(question);
    if (waterVsPowder) return false;

    // Never re-ask about additions the model explicitly says are accounted for.
    if (
      food.visibleAdditionsFullyAccountedFor === true &&
      (item.id.startsWith("prepared_drink_additions_") ||
        /\b(did you add anything else|any other additions)\b/.test(question))
    ) {
      return false;
    }

    // A readable label already gives this specific drink's nutrition, so a
    // generic type/variety question cannot improve that logged estimate.
    // Keep quantitative and preparation questions even for labelled products.
    if (food.nutritionSource === "NUTRITION_LABEL") {
      if (item.id === `variety_${item.foodIndex}`) return false;
      if (/\b(type|variety)\b/.test(question) &&
          /\b(drink|tea|coffee|beverage|mocktail)\b/.test(question) &&
          !/\b(amount|how many|how much|added|sachets?)\b/.test(question)) {
        return false;
      }
    }

    return true;
  });

  if (clarifications.length === analysis.clarifications.length) return analysis;
  return { ...analysis, clarifications };
}
