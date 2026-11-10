/** Safe query parsing and stable ranking for reviewed packaged-food matches. */
export function normalizeSmartFoodQuery(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function smartFoodTokens(value: string): string[] {
  return normalizeSmartFoodQuery(value).toLocaleLowerCase().split(" ").filter(token => token.length >= 2).slice(0, 7);
}

export function foodMatchScore(food: { name: string; brand: string }, query: string): number {
  const tokens = smartFoodTokens(query);
  if (!tokens.length) return 0;
  const name = food.name.toLocaleLowerCase();
  const brand = food.brand.toLocaleLowerCase();
  const matched = tokens.filter(token => name.includes(token) || brand.includes(token));
  if (!matched.length) return 0;
  return matched.length * 10 + (matched.length === tokens.length ? 40 : 0) +
    (name.startsWith(tokens[0]) ? 5 : 0) + (brand.startsWith(tokens[0]) ? 3 : 0);
}
