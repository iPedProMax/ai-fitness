import { describe, expect, it } from "vitest";
import { coachReply, coachTopics } from "./coach-guidance";
describe("local coach starter", () => {
  it("has a useful response for each topic", () => { for (const t of coachTopics) expect(coachReply(t.id).length).toBeGreaterThan(50); });
  it("avoids generating API calls or pretending to know user records", () => {
    const combined = coachTopics.map(t => coachReply(t.id)).join(" ");
    expect(combined).not.toContain("your recorded");
  });
});
