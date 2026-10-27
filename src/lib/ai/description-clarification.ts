import type { FoodAnalysis } from "@/lib/food-analysis";

type Food = FoodAnalysis["foods"][number];

/** Only facts explicitly supplied by the user can resolve these questions.
 * This post-processing does not call an AI or invent food identities/macros. */
export function applyDescriptionClarificationAnswers(
  analysis: FoodAnalysis,
  description: string,
): FoodAnalysis {
  if (!description.trim() || analysis.foods.length !== 1) return analysis;

  const text = description.toLowerCase().replace(/[\u2019']/g, "").replace(/\s+/g, " ");
  const original = analysis.foods[0];
  const foodName = original.name.toLowerCase();
  const isOats = /\b(oats?|oatmeal)\b/.test(foodName) && /\b(oats?|oatmeal)\b/.test(text);
  const isRice = /\brice\b/.test(foodName) && /\brice\b/.test(text);
  // For other foods, a labelled brand is accepted only when a substantive food
  // word occurs in both the model's identification and the user's description.
  const words = foodName.match(/[a-z]{4,}/g) ?? [];
  const commonWords = new Set(["with", "from", "plain", "food", "dried", "fresh", "cooked", "prepared", "mixed", "instant", "brand", "small", "large", "bowl", "meat"]);
  const sameFood = isOats || isRice || words.some(word => !commonWords.has(word) && new RegExp(`\\b${word}\\b`).test(text));

  // A typed brand is evidence of what the user says the product is, but only
  // when there is enough information to associate it with the detected food.
  const hasBrand = sameFood && !/\b(?:maybe|not\s+sure|unsure|probably)\s+(?:the\s+)?(?:brand\s+is\s+)?quaker\b/.test(text) && (
    (isOats && /\bquaker\b/.test(text)) ||
    /\bbrand\s*(?:is|:|=)\s*(?!unknown\b|not\s+sure\b|none\b)[a-z][a-z0-9'-]{1,}/.test(text)
  );

  // Only explicit product varieties count; "oats" by itself does not specify
  // instant vs rolled. Conflicting varieties still require clarification.
  const oatVarieties = [
    /\binstant\s+(?:rolled\s+)?oats?\b/,
    /\brolled\s+oats?\b/,
    /\bsteel[ -]?cut\s+oats?\b/,
    /\bquick[ -]?(?:cook|cooking)\s+oats?\b/,
  ];
  const riceVarieties = [
    /\bjasmine\s+rice\b/,
    /\bbasmati\s+rice\b/,
    /\bbrown\s+rice\b/,
    /\bglutinous\s+rice\b/,
    /\b(?:dinorado|sinandomeng)\s+rice\b/,
  ];
  const matches = isOats ? oatVarieties.filter(r => r.test(text)) : isRice ? riceVarieties.filter(r => r.test(text)) : [];
  // Instant oats can also be rolled flakes. Nonetheless when the person states
  // both competing varieties, do not silently decide on their behalf.
  const hasVariety = matches.length === 1 && !/\b(?:maybe|not\s+sure|unsure|either|probably)\b/.test(text);

  // Grams alone never imply tare. Treat a specific user statement like
  // "yes its tared" as confirmation; model claims are not enough.
  const uncertain = /\b(?:maybe|not\s+sure|unsure|probably|possibly|might|guess|think)\b/.test(text);
  const negative = /\b(?:not\s+tared|not\s+zeroed|(?:wasnt|isnt|didnt|havent|never)\s+(?:\w+\s+){0,3}(?:tared|zeroed))\b/.test(text);
  const positive = /\byes\s+(?:(?:it(?:s|\s+is|\s+was)?)|(?:(?:the|my)\s+)?(?:scale|bowl|container))\s+(?:(?:is|was)\s+)?tared\b/.test(text) ||
    /\bit(?:s|\s+is|\s+was)\s+tared\b/.test(text) ||
    /\b(?:i|we)\s+(?:(?:have|already)\s+)?(?:tared|zeroed)\s+(?:(?:the|my)\s+)?(?:scale|bowl|container)\b/.test(text) ||
    /\b(?:scale|bowl|container)\s+(?:is|was|has\s+been)\s+(?:tared|zeroed)\b/.test(text);
  const hasReading = original.scaleReadingGrams !== undefined && Number.isFinite(original.scaleReadingGrams) && original.scaleReadingGrams > 0 && original.scaleReadingGrams <= 10000;
  const statedGrams = text.match(/\b(\d{1,4}(?:\.\d+)?)\s*(?:g|grams)\b/);
  const consistentReading = !statedGrams || (hasReading &&
    Math.abs(Number(statedGrams[1]) - original.scaleReadingGrams!) <= Math.max(2, original.scaleReadingGrams! * 0.05));
  const tareYes = !uncertain && !negative && positive && hasReading && consistentReading && original.estimatedGrams > 0;
  const tareNo = !uncertain && negative && !positive && hasReading;

  let food: Food = original;
  let note = "";
  if (tareYes) {
    const grams = original.scaleReadingGrams!;
    if (original.weightSource !== "SCALE_MEASURED") {
      const ratio = grams / original.estimatedGrams;
      const round = (n: number) => Math.round(n * 10) / 10;
      food = { ...food, estimatedGrams: grams,
        calories: round(food.calories * ratio), protein: round(food.protein * ratio),
        carbs: round(food.carbs * ratio), fat: round(food.fat * ratio),
        weightSource: "SCALE_MEASURED" };
    }
    note = `User explicitly confirmed in the description that the container was tared; scale reading ${grams} g was used as food-only weight.`;
  } else if (tareNo) {
    food = { ...food, weightSource: "AI_ESTIMATE" };
    note = "User explicitly said the container was not tared; scale reading was not used as food-only weight.";
  }
  if (hasBrand) food = { ...food, brandStatus: "KNOWN" };
  if (hasVariety) food = { ...food, varietyStatus: "KNOWN" };

  const clarifications = analysis.clarifications.filter(item => {
    if (item.foodIndex !== 0) return true;
    if ((tareYes || tareNo) && item.id.startsWith("tare_status_")) return false;
    if (hasBrand && (item.id === "brand_0" || /\bbrand\b|\bexact product\b/i.test(item.question))) return false;
    if (hasVariety && (item.id === "variety_0" || /\b(type|variety)\b/i.test(item.question))) return false;
    return true;
  });
  if (food === original && clarifications.length === analysis.clarifications.length) return analysis;
  return {
    ...analysis,
    foods: [food],
    totalCalories: food.calories,
    clarifications,
    notes: note ? `${analysis.notes.trim()} ${note}`.trim() : analysis.notes,
  };
}
