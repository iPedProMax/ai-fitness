/** Client and server-facing UI policy. Keep aligned with the active adapter capabilities.
 * Groq stays text-only until its vision transport and accounting are implemented. */
export const PROVIDER_IMAGE_LIMITS = {
  gemini: 10,
  cloudflare: 1,
  groq: 0,
} as const;

export type AiProviderChoice = keyof typeof PROVIDER_IMAGE_LIMITS;

export function getProviderMaxImages(provider: AiProviderChoice): number {
  return PROVIDER_IMAGE_LIMITS[provider];
}
