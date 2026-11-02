import { describe, expect, it } from "vitest";
import { adaptAuraMessages, normalizeAuraMessages } from "./aura-conversation";

describe("AURA floating/full chat continuity", () => {
  it("converts floating user/assistant messages into full-page author/text messages", () => {
    const floating = [
      { role: "user", content: "What about protein?" },
      { role: "assistant", content: "Eggs can help." },
    ];
    const saved = normalizeAuraMessages(floating);
    expect(saved).toEqual([
      { who: "you", text: "What about protein?" },
      { who: "coach", text: "Eggs can help." },
    ]);
    const result = adaptAuraMessages(saved, [{ id: 0, author: "coach", text: "Welcome" }]);
    expect(result).toEqual([
      expect.objectContaining({ id: 0, author: "you", text: "What about protein?" }),
      expect.objectContaining({ id: 1, author: "coach", text: "Eggs can help." }),
    ]);
  });
  it("supports either author/text or role/content and limits stored data", () => {
    const saved = normalizeAuraMessages([
      { author: "you", text: "rice" },
      { author: "coach", text: "130 kcal" },
      { author: "you", text: "" },
    ]);
    expect(saved.map(item => item.who)).toEqual(["you", "coach"]);
    expect(adaptAuraMessages(saved, [{ role: "assistant", content: "Welcome" }]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ role: "user", content: "rice" })]));
    expect(normalizeAuraMessages(Array.from({ length: 60 }, (_, i) => ({ role: "user", text: String(i) }))))
      .toHaveLength(50);
  });
  it("ignores malformed messages and does not invent a conversation", () => {
    expect(normalizeAuraMessages(null)).toEqual([]);
    expect(normalizeAuraMessages([{ role: "user", text: "" }, {}, null])).toEqual([]);
  });
});
