import "server-only";
import { aiModelCatalog, isGeminiModelId, type AiModelStatus } from "./model-catalog";
import { readFreeGeminiPolicies } from "./free-gemini-policy";

/** Reports local free-tier authorization and local quota headroom, NOT Google's
 * live remaining quota. Every generation is rechecked atomically on admission. */
export async function getAiModelStatuses(): Promise<AiModelStatus[]> {
  const policies = await readFreeGeminiPolicies();
  const configured = process.env.AI_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
  return aiModelCatalog.map(model => {
    if (isGeminiModelId(model.id)) {
      const policy = policies.get(model.id);
      // Legacy default stays backward-compatible if the read-only RPC is not
      // yet installed; its original atomic provider policy still blocks dispatch.
      const enabled = configured && (policy?.enabled ?? model.id === "gemini");
      const reason = enabled ? null : !configured ? "AI analysis is paused or Gemini is not configured"
        : policy?.reason ?? "Free-tier model not activated in staging";
      return { ...model, enabled, reason };
    }
    return { ...model, enabled: false, reason: model.id === "cloudflare" || model.id === "groq"
      ? "Integration built; free-tier activation not yet verified" : "Integration not installed yet" };
  });
}
