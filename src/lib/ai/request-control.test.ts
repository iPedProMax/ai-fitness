import { describe, expect, it } from "vitest";
import { fingerprintRequest } from "./request-control";

describe("idempotency payload binding", () => {
  it("canonicalizes JSON property order but binds the endpoint and values", async () => {
    const request = (path: string, body: string) => new Request(`http://localhost${path}`, { method: "POST", body });
    const first = await fingerprintRequest(request("/food/text", '{"b":2,"a":1}'));
    expect(await fingerprintRequest(request("/food/text", '{"a":1,"b":2}'))).toBe(first);
    expect(await fingerprintRequest(request("/food/refine", '{"a":1,"b":2}'))).not.toBe(first);
    expect(await fingerprintRequest(request("/food/text", '{"a":1,"b":3}'))).not.toBe(first);
  });
  it("ignores multipart transport boundaries and binds ordered image bytes", async () => {
    const request = (values: string[]) => {
      const body = new FormData();
      values.forEach(value => body.append("images", new File([value], "food.jpg", { type: "image/jpeg" })));
      return new Request("http://localhost/food/analyze", { method: "POST", body });
    };
    expect(await fingerprintRequest(request(["one", "two"]))).toBe(await fingerprintRequest(request(["one", "two"])));
    expect(await fingerprintRequest(request(["two", "one"]))).not.toBe(await fingerprintRequest(request(["one", "two"])));
  });
});
