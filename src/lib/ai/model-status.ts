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
    if (model.id === "ollama-local") {
      const policy = policies.get(model.id);
      const localOnly = process.env.NODE_ENV !== "production" && process.env.AI_ENABLE_OLLAMA_LOCAL === "true";
      const enabled = localOnly && process.env.AI_ENABLED === "true" && policy?.enabled === true;
      return { ...model, enabled, reason: enabled ? null : !localOnly
        ? "Local Ollama is disabled (development only, no cloud billing)"
        : policy?.reason ?? "Local Ollama staging policy not activated" };
    }
    if (model.id === "cloudflare-vision") {
      // Logical Photo Scanner slot backed by the existing Cloudflare provider policy.
      // The pilot is OFF by default. Never route the Scout text experiment as Vision.
      const policy = policies.get("cloudflare");
      const configured = process.env.AI_ENABLE_CLOUDFLARE_VISION_PILOT === "true" &&
        process.env.AI_ENABLE_CLOUDFLARE_FREE === "true" &&
        process.env.AI_CLOUDFLARE_VISION_MODEL !== "scout" &&
        Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN);
      const enabled = process.env.AI_ENABLED === "true" && configured && policy?.enabled === true;
      return { ...model, enabled, reason: enabled ? null : !configured
        ? "Cloudflare Vision pilot is disabled or not configured"
        : policy?.reason ?? "Cloudflare provider policy not approved" };
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
    if (model.id === "openrouter-vision" || model.id === "zai-vision") {
      const openrouter = model.id === "openrouter-vision";
      // Existing provider rows govern both text and photo slots; no new quotas.
      const policy = policies.get(openrouter ? "openrouter" : "zai");
      const configured = openrouter
        ? process.env.AI_ENABLE_OPENROUTER_VISION_PILOT === "true" &&
          process.env.AI_ENABLE_OPENROUTER_FREE === "true" &&
          process.env.OPENROUTER_FREE_ONLY_CONFIRMED === "true" &&
          Boolean(process.env.OPENROUTER_API_KEY)
        : process.env.AI_ENABLE_ZAI_VISION_PILOT === "true" &&
          process.env.AI_ENABLE_ZAI_FREE === "true" &&
          process.env.ZAI_ZERO_SPEND_CONFIRMED === "true" &&
          Boolean(process.env.ZAI_API_KEY);
      const enabled = process.env.AI_ENABLED === "true" && configured && policy?.enabled === true;
      return { ...model, enabled, reason: enabled ? null : !configured
        ? "Vision pilot disabled until free-tier credentials and opt-in are confirmed"
        : policy?.reason ?? "Provider not approved in the shared staging policy" };
    }
    if (["openrouter", "zai", "siliconflow", "huggingface", "cerebras"].includes(model.id)) {
      const localConfig: Record<string, boolean> = {
        openrouter: process.env.AI_ENABLE_OPENROUTER_FREE === "true" && process.env.OPENROUTER_FREE_ONLY_CONFIRMED === "true" && Boolean(process.env.OPENROUTER_API_KEY),
        zai: process.env.AI_ENABLE_ZAI_FREE === "true" && process.env.ZAI_ZERO_SPEND_CONFIRMED === "true" && Boolean(process.env.ZAI_API_KEY),
        siliconflow: process.env.AI_ENABLE_SILICONFLOW_FREE === "true" && process.env.SILICONFLOW_ZERO_SPEND_CONFIRMED === "true" && Boolean(process.env.SILICONFLOW_API_KEY),
        huggingface: process.env.AI_ENABLE_HUGGINGFACE_FREE === "true" && process.env.HUGGINGFACE_ZERO_SPEND_CONFIRMED === "true" && Boolean(process.env.HF_TOKEN),
        cerebras: process.env.AI_ENABLE_CEREBRAS_FREE === "true" && process.env.CEREBRAS_FREE_PLAN_CONFIRMED === "true" && Boolean(process.env.CEREBRAS_API_KEY),
      };
      const policy = policies.get(model.id);
      const enabled = process.env.AI_ENABLED === "true" && localConfig[model.id] && policy?.enabled === true;
      return { ...model, enabled, reason: enabled ? null : !localConfig[model.id]
        ? "Text provider disabled until zero-spend usage is verified"
        : policy?.reason ?? "Text provider database policy not approved" };
    }
    return { ...model, enabled: false, reason: "Integration not installed yet" };
  });
}
