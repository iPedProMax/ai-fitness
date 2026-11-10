import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { buildMistralBody, MISTRAL_MODEL } from "./providers/mistral";

const schema = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] };

describe("Phase U8 Mistral Coach request reliability and safe errors", () => {
  it("uses plain string content for text-only requests, matching the successful API smoke path", () => {
    const body = JSON.parse(buildMistralBody({
      input: [{ type: "text", text: "Return JSON with only the reply key." }], responseSchema: schema,
    }));
    expect(body.model).toBe(MISTRAL_MODEL);
    expect(body.model).toBe("ministral-14b-2512");
    expect(body.messages).toEqual([{ role: "user", content: "Return JSON with only the reply key." }]);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "coach_reply", strict: true, schema: { required: ["reply"], additionalProperties: false } } });
  });
  it("preserves multimodal formatting when an image is present, without enabling it in the UI", () => {
    const body = JSON.parse(buildMistralBody({
      input: [{ type: "text", text: "Describe" }, { type: "image", mimeType: "image/png", data: "YWJjZA==" }],
      responseSchema: schema,
    }));
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[0]).toEqual({ type: "text", text: "Describe" });
    expect(body.messages[0].content[1].type).toBe("image_url");
  });
  it("returns safe error codes for invalid coaching replies and rejected provider requests", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/coach/chat/route.ts"), "utf8");
    expect(route).toContain("AI_COACH_REPLY_FORMAT");
    expect(route).toContain("AI_COACH_PROVIDER_REJECTED");
    expect(route).not.toContain("console.log(error)");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });
});