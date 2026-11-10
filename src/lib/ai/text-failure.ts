/** Safe public diagnostics for failures in the Text AI estimation endpoint. */
export type TextAiFailureCategory =
  | "UPSTREAM_HTTP"
  | "OUTPUT_INCOMPLETE"
  | "OUTPUT_INVALID_JSON"
  | "OUTPUT_INVALID_SCHEMA"
  | "UNEXPECTED_FAILURE";

export type TextAiFailure = {
  category: TextAiFailureCategory;
  code: string;
  message: string;
  upstreamStatus: number | null;
};

/** Never return, log, or display upstream error bodies, keys, or input text. */
export function classifyTextAiFailure(error: unknown): TextAiFailure {
  const record: Record<string, unknown> = error !== null && typeof error === "object"
    ? error as Record<string, unknown> : {};
  const status = typeof record.status === "number" ? record.status
    : typeof record.statusCode === "number" ? record.statusCode : null;
  const upstreamStatus = status !== null && Number.isInteger(status) && status >= 400 && status <= 599
    ? status : null;

  if (upstreamStatus !== null) {
    return {
      category: "UPSTREAM_HTTP", code: "AI_TEXT_UPSTREAM_REJECTED",
      message: upstreamStatus === 429
        ? "The selected Text AI is rate limited. Please try another provider later, or enter the values manually."
        : "The selected Text AI could not complete the request. Try another provider or enter nutrition manually.",
      upstreamStatus,
    };
  }
  if (error instanceof SyntaxError || record.name === "SyntaxError") {
    return {
      category: "OUTPUT_INVALID_JSON", code: "AI_TEXT_INVALID_JSON",
      message: "The selected Text AI returned unreadable nutrition data. Try another provider or enter nutrition manually.",
      upstreamStatus: null,
    };
  }
  if (record.name === "ZodError") {
    return {
      category: "OUTPUT_INVALID_SCHEMA", code: "AI_TEXT_INVALID_SCHEMA",
      message: "The selected Text AI did not return the nutrition fields Khalories requires. Try another provider or enter nutrition manually.",
      upstreamStatus: null,
    };
  }
  if (record.message === "Text provider output incomplete") {
    return {
      category: "OUTPUT_INCOMPLETE", code: "AI_TEXT_INCOMPLETE",
      message: "The selected Text AI stopped before finishing its estimate. Try another provider or enter nutrition manually.",
      upstreamStatus: null,
    };
  }
  return {
    category: "UNEXPECTED_FAILURE", code: "AI_TEXT_ESTIMATE_FAILED",
    message: "The selected Text AI could not complete this estimate. Try another provider or enter nutrition manually.",
    upstreamStatus: null,
  };
}