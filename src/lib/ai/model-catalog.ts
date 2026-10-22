/** Display information only. Availability comes from our server, never this file. */
export const aiModelCatalog = [
  { id: "gemini", name: "Google Gemini", maxImages: 10, text: true, vision: true },
  { id: "cloudflare", name: "Cloudflare Workers AI", maxImages: 1, text: true, vision: true },
  { id: "groq", name: "GroqCloud", maxImages: 0, text: true, vision: false },
  { id: "openrouter", name: "OpenRouter", maxImages: 0, text: false, vision: false },
  { id: "mistral", name: "Mistral AI", maxImages: 0, text: false, vision: false },
  { id: "huggingface", name: "Hugging Face", maxImages: 0, text: false, vision: false },
  { id: "cerebras", name: "Cerebras", maxImages: 0, text: false, vision: false },
] as const;

export type AiModelId = (typeof aiModelCatalog)[number]["id"];
export type AiModelStatus = {
  id: AiModelId;
  name: string;
  maxImages: number;
  text: boolean;
  vision: boolean;
  enabled: boolean;
  reason: string | null;
};
export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === "string" && aiModelCatalog.some(model => model.id === value);
}
