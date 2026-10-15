import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Install the fake fetch before importing the real SDK. No HTTP can escape.
const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
});

import { createGeminiProvider } from "./providers/gemini";
import { generateWithFallback } from "./router";
import type { AiGenerationRequest } from "./types";

const request: AiGenerationRequest = {
  input: [{ type: "text", text: "Estimate rice" }], responseSchema: { type: "object" },
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("real Gemini SDK with network mocked", () => {
  it("falls back for a genuine SDK-wrapped network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const primary = createGeminiProvider("test-key");
    const backup = { ...primary, id: "mock-backup", generate: vi.fn().mockResolvedValue({ outputText: "{}" }) };
    await expect(generateWithFallback([primary, backup], request)).resolves.toEqual({ outputText: "{}" });
    expect(backup.generate).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not fall back when the SDK wraps an unknown fetch/programming error", async () => {
    fetchMock.mockRejectedValue(new Error("Synthetic unknown transport error"));
    const primary = createGeminiProvider("test-key");
    const backup = { ...primary, id: "mock-backup", generate: vi.fn().mockResolvedValue({ outputText: "{}" }) };
    await expect(generateWithFallback([primary, backup], request)).rejects.toMatchObject({ name: "APIConnectionError" });
    expect(backup.generate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([429, 503])("disables hidden SDK retries on HTTP %i", async status => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      error: { code: status, message: "Synthetic temporary failure", status: "UNAVAILABLE" },
    }), { status, headers: { "Content-Type": "application/json" } }));
    await expect(generateWithFallback([createGeminiProvider("test-key")], request)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forwards cancellation to the SDK fetch and bounds hanging HTTP", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((input, init) => new Promise((_resolve, reject) => {
      const signal = input instanceof Request ? input.signal : init?.signal;
      signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    }));
    const pending = generateWithFallback([createGeminiProvider("test-key")], request, { attemptTimeoutMs: 20 });
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const signal = input instanceof Request ? input.signal : init?.signal;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
