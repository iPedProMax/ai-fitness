/** Local, deterministic coaching prompts. No model calls, user records, or medical claims. */
export type CoachTopic = "meals" | "protein" | "movement" | "consistency";
export const coachTopics: { id: CoachTopic; label: string }[] = [
  { id: "meals", label: "Plan a balanced meal" },
  { id: "protein", label: "Get enough protein" },
  { id: "movement", label: "Plan today's activity" },
  { id: "consistency", label: "Stay consistent" },
];
export function coachReply(topic: CoachTopic): string {
  switch (topic) {
    case "meals": return "Build your next plate around a protein source, colorful vegetables or fruit, and a satisfying carbohydrate. Portion needs depend on your goals, appetite and activity. Log the ingredients and quantities for a better estimate.";
    case "protein": return "Spread protein-rich foods across your meals: eggs, fish, chicken, tofu, beans or yogurt if tolerated. Your ideal daily amount depends on your goals and health context, so avoid treating a generic number as a prescription.";
    case "movement": return "Choose movement you can do comfortably: a walk, cycling, or a short resistance workout. Start at an easy pace, build gradually, and stop if something causes pain. Consistency matters more than a perfect session.";
    case "consistency": return "Keep the target small: log one meal, take a short walk, or prepare tomorrow's breakfast. Progress comes from repeatable habits, not from being perfect every day.";
  }
}
