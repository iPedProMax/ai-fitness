/**
 * Phase U10B: non-blocking portion and preparation review for text-AI meals.
 * These are prompts for the user, not nutritional facts or automatic corrections.
 * No hardcoded recipe calories or third-party calls; no account or credit usage.
 */
export type FoodContextRow = { name: string; grams: string; calories: string };

/**
 * Only surface a prompt when a recognizable food and a genuinely relevant
 * omission are present. Keep all food input untouched.
 */
export function findFoodContextWarnings(
  rows: readonly FoodContextRow[], description: string,
): string[] {
  const typed = description.trim().toLowerCase();
  const names = rows.map(row => row.name.trim().toLowerCase()).join(" ");
  const context = `${typed} ${names}`;
  const notes: string[] = [];
  // A gram value for sauce, oil or broth is NOT a measured weight for the
  // accompanying rice/meat. Check both "sauce 30g" and "30g sauce" orders.
  // Only user-typed main-food weights trigger raw/cooked and fish-weight prompts.
  const gramMeasurements = [...typed.matchAll(/\b\d+(?:\.\d+)?\s*(?:g|grams?|kg)\b/g)];
  const measured = gramMeasurements.some(match => {
    const offset = match.index ?? 0;
    const preceding = typed.slice(Math.max(0, offset - 45), offset);
    const following = typed.slice(offset + match[0].length, offset + match[0].length + 45);
    const precedingModifier = /\b(?:sauce|oil|marinade|broth|water|vinegar|soy\s+sauce|toyo|patis)\s*$/.test(preceding);
    const followingModifier = /^\s*(?:of\s+)?(?:sauce|oil|marinade|broth|water|vinegar|soy\s+sauce|toyo|patis)\b/.test(following);
    return !precedingModifier && !followingModifier;
  });
  const edibleWeight = /\b(?:boneless|deboned|fillet|edible(?:\s+(?:portion|meat|weight))?|meat\s+only|bones?\s+removed|without\s+bones?)\b/.test(typed);
  const cookingState = /\b(?:raw|uncooked|dry|cooked|steamed|boiled|grilled|fried|roasted|baked|sauteed|sauteed|braised|barbecued|barbequed|bbq|inasal|inihaw)\b/.test(typed);

  // We only ask raw-vs-cooked when a measured quantity was actually typed.
  // AI-generated weights do not count as confirmed user measurements.
  if (measured && !cookingState && /\b(?:rice|bigas|kanin|pasta|noodles?|pork|chicken|beef|fish|bangus|tilapia)\b/.test(typed)) {
    notes.push("You entered a weight without saying raw or cooked. That can change the calories per gram; confirm which state you weighed.");
  }

  // Fish weight can include bones/head, but the actual edible portion may differ.
  if (measured && /\b(?:bangus|tilapia|galunggong|whole\s+fish)\b/.test(context) && !edibleWeight) {
    notes.push("For fish, confirm whether the weighed amount includes head/bones or is edible meat only. The AI should not assume all weighed grams were eaten.");
  }

  // These are soups or brothy dishes; 1 bowl can be mostly broth or mostly solids.
  if (/\b(?:sinigang|tinola|bulalo)\b/.test(context) &&
      !/\b(?:broth\s+only|meat\s+only|including\s+broth|includes?\s+broth|with\s+broth|without\s+broth|no\s+broth|soup\s+only)\b/.test(typed)) {
    notes.push("For sinigang, tinola or bulalo, specify whether the serving includes broth, meat and vegetables. A bowl size alone doesn't establish each amount.");
  }

  // Mixed Filipino preparations can differ in sauce, oil, fatty cuts and recipe.
  // Do not assign a fixed calorie value to a cuisine name.
  if (/\b(?:adobo|afritada|menudo|caldereta|kaldereta|kare[\s-]?kare|pancit|lechon\s+kawali)\b/.test(context) &&
      !/\b(?:no\s+(?:added\s+)?oil|oil\s*free|no\s+sauce|sauce\s*free)\b/.test(typed) &&
      !/\b(?:oil|sauce|marinade)\s*(?::|=|of\s+)?\s*\d+(?:\.\d+)?\s*(?:g|grams?|ml|tsp|tbsp|teaspoons?|tablespoons?)\b/.test(typed) &&
      !/\b\d+(?:\.\d+)?\s*(?:g|grams?|ml|tsp|tbsp|teaspoons?|tablespoons?)\s*(?:of\s+)?(?:oil|sauce|marinade)\b/.test(typed)) {
    notes.push("For mixed dishes (such as adobo or pancit), the cut of meat and amount of oil/sauce can change the estimate. Check what was actually in your serving.");
  }

  // A 'stick' or 'piece' is not a standardized edible-weight unit.
  if (/\b(?:pork\s+(?:bbq|barbeque|barbecue)|(?:bbq|barbeque|barbecue)\s+pork|pork\s+inasal)\b/.test(context) &&
      /\b\d+\s*(?:(?:pork\s+)?(?:bbq|barbeque|barbecue)\s*)?(?:pcs?|pieces?|sticks?|skewers?)\b/.test(typed) && !measured) {
    notes.push("Pork BBQ sticks/pieces vary in meat size and fat. If possible, estimate the edible meat weight rather than treating every stick as identical.");
  }

  return notes.slice(0, 4);
}