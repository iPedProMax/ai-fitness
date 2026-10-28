/** Client and server-facing UI policy. Keep aligned with the active adapter capabilities.
 * Groq vision is capped by this app at two images for reliable free-tier usage. */
export const PROVIDER_IMAGE_LIMITS = {
  gemini: 10,
  cloudflare: 1,
  groq: 2,
  mistral: 1,
} as const;

export type AiProviderChoice = keyof typeof PROVIDER_IMAGE_LIMITS;

export function getProviderMaxImages(provider: AiProviderChoice): number {
  return PROVIDER_IMAGE_LIMITS[provider];
}
