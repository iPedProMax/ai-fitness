import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithFallback, selectCompatibleProviders } from "./router";
import type { AiGenerationRequest, AiProvider } from "./types";

const request: AiGenerationRequest = {
  input: [{ type: "text", text: "Estimate rice" }],
  responseSchema: { type: "object" },
};
const result = { outputText: '{"foods":[]}' };

function mockProvider(id = "gemini", overrides: Partial<Omit<AiProvider, "generate">> = {}) {
  return {
    id, enabled: true, available: true,
    capabilities: { text: true, vision: true, maxImages: 10, structuredJson: true },
    generate: vi.fn<AiProvider["generate"]>().mockResolvedValue(result),
    ...overrides,
  };
}

function imageRequest(count = 1): AiGenerationRequest {
  return { ...request, input: [...request.input, ...Array.from({ length: count }, () => ({
    type: "image" as const, data: "Zm9vZA==", mimeType: "image/jpeg" as const,
  }))] };
}

afterEach(() => vi.useRealTimers());

describe("capability-aware provider selection", () => {
  it("prefers Gemini even if a compatible backup is listed first", () => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    expect(selectCompatibleProviders([backup, primary], request)).toEqual([primary, backup]);
  });

  it("excludes disabled, unavailable, non-text, and non-JSON providers", () => {
    const good = mockProvider();
    const disabled = mockProvider("disabled", { enabled: false });
    const unavailable = mockProvider("unavailable", { available: false });
    const noText = mockProvider("no-text", { capabilities: { ...good.capabilities, text: false } });
    const noJson = mockProvider("no-json", { capabilities: { ...good.capabilities, structuredJson: false } });
    expect(selectCompatibleProviders([disabled, unavailable, noText, noJson, good], request)).toEqual([good]);
  });

  it("allows text-only providers for text but never sends them photos", async () => {
    const textOnly = mockProvider("text-only", {
      capabilities: { text: true, vision: false, maxImages: 0, structuredJson: true },
    });
    expect(selectCompatibleProviders([textOnly], request)).toEqual([textOnly]);
    await expect(generateWithFallback([textOnly], imageRequest())).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(textOnly.generate).not.toHaveBeenCalled();
  });

  it("preserves the ten-image Gemini range and skips smaller vision providers", async () => {
    const primary = mockProvider();
    const small = mockProvider("small-vision", { capabilities: { ...primary.capabilities, maxImages: 3 } });
    await expect(generateWithFallback([small, primary], imageRequest(10))).resolves.toEqual(result);
    expect(primary.generate).toHaveBeenCalledOnce();
    expect(small.generate).not.toHaveBeenCalled();
    await expect(generateWithFallback([primary], imageRequest(11))).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(primary.generate).toHaveBeenCalledOnce();
  });

  it("fails clearly without making calls when no provider is configured or available", async () => {
    await expect(generateWithFallback([], request)).rejects.toMatchObject({
      code: "NO_COMPATIBLE_PROVIDER", message: "No compatible AI provider is available for this request.",
    });
    const disabled = mockProvider("off", { enabled: false });
    await expect(generateWithFallback([disabled], request)).rejects.toMatchObject({ code: "NO_COMPATIBLE_PROVIDER" });
    expect(disabled.generate).not.toHaveBeenCalled();
  });
});

describe("bounded fallback", () => {
  it("returns primary success without calling the backup or changing its output", async () => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    await expect(generateWithFallback([backup, primary], request)).resolves.toBe(result);
    expect(primary.generate).toHaveBeenCalledOnce();
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it.each([408, 429, 500, 502, 503, 504])("falls back once for HTTP %i", async (status) => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    primary.generate.mockRejectedValue({ status });
    await expect(generateWithFallback([primary, backup], request)).resolves.toEqual(result);
    expect(primary.generate).toHaveBeenCalledOnce();
    expect(backup.generate).toHaveBeenCalledOnce();
    expect(backup.generate.mock.calls[0][0]).toMatchObject(request);
  });

  it.each([400, 401, 403, 404, 422])("does not retry HTTP %i errors", async (status) => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    const error = Object.assign(new Error("Permanent failure"), { status });
    primary.generate.mockRejectedValue(error);
    await expect(generateWithFallback([primary, backup], request)).rejects.toBe(error);
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it.each([
    new Error("Unknown programming or validation error"),
    { status: 429, code: "AI_QUOTA_EXCEEDED" },
    { name: "ZodError" },
    { name: "AbortError" },
  ])("does not retry unknown, user-quota, validation, or cancellation failures: %j", async (error) => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    primary.generate.mockRejectedValue(error);
    await expect(generateWithFallback([primary, backup], request)).rejects.toBe(error);
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it("skips an incompatible text backup on photo failure", async () => {
    const primary = mockProvider();
    primary.generate.mockRejectedValue({ status: 503 });
    const backup = mockProvider("mock-backup", { capabilities: { ...primary.capabilities, vision: false } });
    await expect(generateWithFallback([primary, backup], imageRequest())).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it("caps attempts at two distinct providers, even with duplicate IDs and more backups", async () => {
    const primary = mockProvider();
    const duplicate = mockProvider();
    const second = mockProvider("second");
    const third = mockProvider("third");
    primary.generate.mockRejectedValue({ status: 503 });
    second.generate.mockRejectedValue({ status: 503 });
    await expect(generateWithFallback([primary, duplicate, second, third], request)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(primary.generate).toHaveBeenCalledOnce();
    expect(second.generate).toHaveBeenCalledOnce();
    expect(duplicate.generate).not.toHaveBeenCalled();
    expect(third.generate).not.toHaveBeenCalled();
  });

  it("does not fallback when its attempt limit is one", async () => {
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    primary.generate.mockRejectedValue({ status: 429 });
    await expect(generateWithFallback([primary, backup], request, { maxAttempts: 1 })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it("aborts a timed-out primary before trying a compatible backup", async () => {
    vi.useFakeTimers();
    const primary = mockProvider();
    primary.generate.mockImplementation(() => new Promise(() => {}));
    const backup = mockProvider("mock-backup");
    const pending = generateWithFallback([primary, backup], request, { attemptTimeoutMs: 20 });
    const assertion = expect(pending).resolves.toEqual(result);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(primary.generate.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(backup.generate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("enforces the overall deadline and ignores late provider completion", async () => {
    vi.useFakeTimers();
    const primary = mockProvider();
    const backup = mockProvider("mock-backup");
    let completeLate!: (value: typeof result) => void;
    primary.generate.mockImplementation(() => new Promise(resolve => { completeLate = resolve; }));
    backup.generate.mockImplementation(() => new Promise(() => {}));
    const pending = generateWithFallback([primary, backup], request, { attemptTimeoutMs: 20, totalTimeoutMs: 30 });
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
    completeLate(result);
    await vi.advanceTimersByTimeAsync(100);
    expect(backup.generate).toHaveBeenCalledOnce();
    expect(backup.generate.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels on caller abort without trying any backup", async () => {
    const controller = new AbortController();
    const primary = mockProvider();
    primary.generate.mockImplementation(() => new Promise(() => {}));
    const backup = mockProvider("mock-backup");
    const pending = generateWithFallback([primary, backup], { ...request, signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    controller.abort();
    await assertion;
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it("does not call any provider for an already aborted request", async () => {
    const primary = mockProvider();
    const controller = new AbortController();
    controller.abort();
    await expect(generateWithFallback([primary], { ...request, signal: controller.signal })).rejects.toMatchObject({ code: "CANCELLED" });
    expect(primary.generate).not.toHaveBeenCalled();
  });

  it.each([{ maxAttempts: 3 }, { maxAttempts: 0 }, { attemptTimeoutMs: 0 }, { totalTimeoutMs: Infinity }])(
    "rejects unsafe routing settings %j before calling providers", async options => {
      const primary = mockProvider();
      await expect(generateWithFallback([primary], request, options)).rejects.toThrow(RangeError);
      expect(primary.generate).not.toHaveBeenCalled();
    },
  );
});
