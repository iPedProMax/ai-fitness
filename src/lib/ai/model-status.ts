import "server-only";
import { aiModelCatalog, type AiModelStatus } from "./model-catalog";

/** Only the tested Gemini route can currently be dispatched. Other adapters are
 * deliberately not registered, even when their credentials exist. A configured
 * model's quota is checked again atomically during request admission. */
export function getAiModelStatuses(): AiModelStatus[] {
  return aiModelCatalog.map(model => {
    const enabled = model.id === "gemini" &&
      process.env.AI_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
    const reason = enabled ? null : model.id === "gemini"
      ? "AI analysis is paused or Gemini is not configured"
      : model.id === "cloudflare" || model.id === "groq"
        ? "Integration built; free-tier activation not yet verified"
        : "Integration not installed yet";
    return { ...model, enabled, reason };
  });
}
