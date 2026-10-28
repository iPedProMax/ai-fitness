/** Display information only. Availability comes from our server, never this file. */
export const aiModelCatalog = [
  { id: "gemini", name: "Gemini 3.5 Flash-Lite", maxImages: 10, text: true, vision: true },
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", maxImages: 10, text: true, vision: true },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", maxImages: 10, text: true, vision: true },
  { id: "cloudflare", name: "Cloudflare Workers AI", maxImages: 1, text: true, vision: true },
  { id: "groq", name: "GroqCloud (Qwen 3.8)", maxImages: 2, text: true, vision: true },
  { id: "openrouter", name: "OpenRouter", maxImages: 0, text: false, vision: false },
  { id: "mistral", name: "Mistral 14B (Experimental)", maxImages: 1, text: true, vision: true },
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

/** Fixed allowlist: user input can never become an arbitrary SDK model string. */
export const geminiModelCodes = {
  gemini: "gemini-3.5-flash-lite",
  "gemini-3.8-flash": "gemini-3.8-flash",
  "gemini-3.6-flash": "gemini-3.6-flash",
} as const;
export type GeminiModelId = keyof typeof geminiModelCodes;
export function isGeminiModelId(value: unknown): value is GeminiModelId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(geminiModelCodes, value);
}
