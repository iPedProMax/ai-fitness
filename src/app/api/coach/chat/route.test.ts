import { describe, expect, it } from "vitest";
import { coachRequestSchema, coachPrompt } from "@/lib/ai/coach-prompt";
describe("AI Coach chat request boundaries", () => {
  it("accepts a short authenticated-looking payload without accessing providers", () => {
    expect(coachRequestSchema.safeParse({model:"gemini",message:"What should I eat for lunch?",history:[]}).success).toBe(true);
  });
  it("rejects overlong input and untrusted extra properties", () => {
    expect(coachRequestSchema.safeParse({model:"gemini",message:"x".repeat(800)}).success).toBe(false);
    expect(coachRequestSchema.safeParse({model:"gemini",message:"Hi!",creditOverride:999}).success).toBe(false);
  });
  it("never claims personalized database context", () => {
    expect(coachPrompt("How was my day?",[])).toContain("no access to saved meals");
  });
});