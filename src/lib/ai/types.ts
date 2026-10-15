/** Provider-neutral transport types; nutrition validation stays with the caller. */
export type AiImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export type AiInputPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: AiImageMimeType };

export type AiGenerationRequest = {
  input: AiInputPart[];
  responseSchema: Record<string, unknown>;
  signal?: AbortSignal;
};

export type AiCapabilities = {
  readonly text: boolean;
  readonly vision: boolean;
  readonly maxImages: number;
  readonly structuredJson: boolean;
};

export type AiGenerationResult = {
  outputText: string | undefined;
};

/** Implementations perform transport only; they never reserve user credits. */
export interface AiProvider {
  readonly id: string;
  readonly enabled: boolean;
  readonly available: boolean;
  readonly capabilities: AiCapabilities;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}
