import { describe, expect, it } from "vitest";
import type { AiModelId, AiModelStatus } from "./model-catalog";
import { isTextAiReady, readyTextAiIds } from "./text-readiness";

const status = (id: AiModelId, enabled: boolean, text = true): AiModelStatus => ({
  id, name: id, maxImages: 0, text, vision: false, enabled, reason: null,
});

describe("manual Text AI readiness from authenticated server statuses", () => {
  it("fails closed while status is unknown or unauthenticated", () => {
    expect(isTextAiReady(null, "mistral")).toBe(false);
    expect(readyTextAiIds(null)).toEqual([]);
    expect(isTextAiReady([], "mistral")).toBe(false);
  });
  it("never considers Vision-only models ready for Manual AI", () => {
    expect(isTextAiReady([status("gemini", true), status("groq", true)], "gemini")).toBe(false);
    expect(readyTextAiIds([status("gemini", true), status("groq", true)])).toEqual([]);
  });
  it("requires enabled AND text capabilities", () => {
    expect(isTextAiReady([status("mistral", false)], "mistral")).toBe(false);
    expect(isTextAiReady([status("mistral", true, false)], "mistral")).toBe(false);
  });
  it("allows a verified Text-roster model only when the server enables it", () => {
    expect(isTextAiReady([status("mistral", true)], "mistral")).toBe(true);
    expect(isTextAiReady([status("mistral", true)], "cerebras")).toBe(false);
  });
  it("returns only allowed enabled Text IDs, in stable roster order", () => {
    expect(readyTextAiIds([
      status("mistral", true), status("gemini", true), status("cerebras", true),
      status("huggingface", false),
    ])).toEqual(["cerebras", "mistral"]);
  });
});