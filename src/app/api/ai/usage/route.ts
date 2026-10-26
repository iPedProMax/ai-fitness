import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { getAiUsage } from "@/lib/ai-usage";

export async function GET() {
  const authError = await requireFoodApiAuth();
  if (authError) return authError;
  return getAiUsage();
}