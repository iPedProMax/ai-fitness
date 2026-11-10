import { describe, expect, it } from "vitest";
import { checkAiRequestSafety } from "./request-safety";

const url = "http://localhost:3000/api/food/text";
const small = (headers: Record<string, string> = {}) => new Request(url, {
  method: "POST", headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify({ description: "1 cup rice" }),
});

describe("Z2.2 AI request admission", () => {
  it("allows normal same-origin requests while preserving the original body", async () => {
    const request = small({ Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" });
    expect(await checkAiRequestSafety(request)).toBeNull();
    expect((await request.json()).description).toBe("1 cup rice");
  });
  it("blocks cross-origin form submissions before AI accounting", async () => {
    const response = await checkAiRequestSafety(small({ Origin: "https://other.example" }));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: "AI_ORIGIN_DENIED" });
  });
  it("blocks browser cross-site metadata even without Origin", async () => {
    const response = await checkAiRequestSafety(small({ "Sec-Fetch-Site": "cross-site" }));
    expect(response?.status).toBe(403);
  });
  it("blocks same-site cross-origin browser posts", async () => {
    const response = await checkAiRequestSafety(small({ "Sec-Fetch-Site": "same-site" }));
    expect(response?.status).toBe(403);
  });
  it("rejects oversized declared lengths without parsing", async () => {
    const request = small({ "Content-Length": String(64 * 1024 + 1) });
    const response = await checkAiRequestSafety(request);
    expect(response?.status).toBe(413);
    expect(await response?.json()).toMatchObject({ code: "AI_INPUT_TOO_LARGE" });
  });
  it("rejects oversized actual body even if Content-Length is absent", async () => {
    const request = new Request(url, {
      method: "POST", body: new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(64 * 1024 + 1)); controller.close(); },
      }), duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await checkAiRequestSafety(request);
    expect(response?.status).toBe(413);
    expect(await response?.json()).toMatchObject({ code: "AI_INPUT_TOO_LARGE" });
  });
  it("allows multi-photo requests within the scanner transport limit", async () => {
    const body = new FormData();
    body.append("images", new File([new Uint8Array(512)], "rice.jpg", { type: "image/jpeg" }));
    const request = new Request("http://localhost:3000/api/food/analyze", { method: "POST", body });
    expect(await checkAiRequestSafety(request)).toBeNull();
    expect((await request.formData()).getAll("images")).toHaveLength(1);
  });
});
