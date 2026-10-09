/** Instant, offline food icons. A generic plate is the fallback. */
export function foodEmoji(name: string): string {
  const food = name.toLocaleLowerCase();
  const mappings: Array<[RegExp, string]> = [
    [/\b(bangus|tilapia|salmon|tuna|fish|sardine)\b/i, "🐟"],
    [/\b(shrimp|prawn|hipon)\b/i, "🍤"],
    [/\b(chicken|manok|adobo)\b/i, "🍗"],
    [/\b(beef|steak|baka)\b/i, "🥩"],
    [/\b(pork|baboy|lechon)\b/i, "🥓"],
    [/\b(rice|kanin|sinangag|lugaw)\b/i, "🍚"],
    [/\b(pancit|bihon|noodles|ramen|pasta|spaghetti)\b/i, "🍜"],
    [/\b(egg|itlog|omelet|omelette)\b/i, "🥚"],
    [/\b(oats|oatmeal|porridge|cereal)\b/i, "🥣"],
    [/\b(milk|gatas|yogurt|yoghurt)\b/i, "🥛"],
    [/\b(coffee|kape|latte|espresso)\b/i, "☕"],
    [/\b(tea|tsaa)\b/i, "🍵"],
    [/\b(banana|saging)\b/i, "🍌"],
    [/\b(apple|mansanas)\b/i, "🍎"],
    [/\b(mango|mangga)\b/i, "🥭"],
    [/\b(bread|tinapay|toast|sandwich)\b/i, "🍞"],
    [/\b(pizza)\b/i, "🍕"],
    [/\b(burger|hamburger)\b/i, "🍔"],
    [/\b(salad|lettuce|vegetables)\b/i, "🥗"],
    [/\b(soup|sinigang|tinola)\b/i, "🍲"],
    [/\b(potato|fries)\b/i, "🍟"],
    [/\b(cake|cupcake)\b/i, "🍰"],
    [/\b(cookie|biscuit)\b/i, "🍪"],
    [/\b(cheese|keso)\b/i, "🧀"],
    [/\b(water|tubig)\b/i, "💧"],
    [/\b(juice|smoothie)\b/i, "🧃"],
  ];
  return mappings.find(([pattern]) => pattern.test(food))?.[1] ?? "🍽️";
}
