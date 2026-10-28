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
    if (model.id === "cloudflare" || model.id === "groq" || model.id === "mistral") {
      const policy = policies.get(model.id);
      const credentialsConfigured = model.id === "cloudflare"
        ? process.env.AI_ENABLE_CLOUDFLARE_FREE === "true" &&
          Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN)
        : model.id === "groq" ? process.env.AI_ENABLE_GROQ_FREE === "true" && Boolean(process.env.GROQ_API_KEY)
        : process.env.AI_ENABLE_MISTRAL_FREE === "true" && process.env.MISTRAL_FREE_PLAN_CONFIRMED === "true" && Boolean(process.env.MISTRAL_API_KEY);
      const enabled = process.env.AI_ENABLED === "true" && credentialsConfigured && policy?.enabled === true;
      return { ...model, enabled, reason: enabled ? null : !credentialsConfigured
        ? "Provider not configured for verified free use" : policy?.reason ?? "Provider policy not activated" };
    }
    return { ...model, enabled: false, reason: "Integration not installed yet" };
  });
}
