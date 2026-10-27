import { afterEach, describe, expect, it, vi } from "vitest";
import { CLOUDFLARE_IMAGE_MAX_EDGE, fitCloudflareImage, prepareCloudflareImage } from "./image-optimization";

const original = (size = 2_000_000) => new File([new Uint8Array(size)], "food.png", { type: "image/png", lastModified: 123 });
afterEach(() => { vi.unstubAllGlobals(); });

describe("Cloudflare-only browser photo optimisation", () => {
  it("bounds long edge without stretching or upscaling", () => {
    expect(CLOUDFLARE_IMAGE_MAX_EDGE).toBe(1600);
    expect(fitCloudflareImage(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitCloudflareImage(600, 900)).toEqual({ width: 600, height: 900 });
    expect(fitCloudflareImage(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(() => fitCloudflareImage(0, 100)).toThrow("Invalid image dimensions");
  });

  it("reencodes a large photo as a smaller JPEG without modifying the original", async () => {
    const source = original();
    const close = vi.fn();
    const bitmap = { width: 4000, height: 3000, close } as unknown as ImageBitmap;
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect, drawImage, fillStyle: "" }),
      toBlob: (cb: (blob: Blob) => void) => cb(new Blob([new Uint8Array(100_000)], { type: "image/jpeg" })) };
    vi.stubGlobal("document", { createElement: () => canvas });
    const result = await prepareCloudflareImage(source);
    expect(result).not.toBe(source);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("food-cloudflare.jpg");
    expect(result.lastModified).toBe(123);
    expect(result.size).toBe(100_000);
    expect(canvas).toMatchObject({ width: 1600, height: 1200 });
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(close).toHaveBeenCalledOnce();
    expect(source.name).toBe("food.png");
    expect(source.size).toBe(2_000_000);
  });

  it("returns the original if image decoding fails or browser APIs are unavailable", async () => {
    const source = original();
    expect(await prepareCloudflareImage(source)).toBe(source);
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode failure")));
    vi.stubGlobal("document", {});
    expect(await prepareCloudflareImage(source)).toBe(source);
  });

  it("keeps a small, already compliant image without recompressing", async () => {
    const source = original(300_000);
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 600, height: 600, close }));
    const createElement = vi.fn();
    vi.stubGlobal("document", { createElement });
    expect(await prepareCloudflareImage(source)).toBe(source);
    expect(createElement).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the original when a non-resized JPEG would be larger", async () => {
    const source = original(600_000);
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1000, height: 1000, close }));
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" }),
      toBlob: (cb: (blob: Blob) => void) => cb(new Blob([new Uint8Array(700_000)])),
    }) });
    expect(await prepareCloudflareImage(source)).toBe(source);
    expect(close).toHaveBeenCalledOnce();
  });
});
