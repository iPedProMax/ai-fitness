import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/food/analyze", () => {
  it("returns 400 when no food image is provided", async () => {
    const formData = new FormData();

    const request = new Request(
      "http://localhost:3000/api/food/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: "Food image is required.",
    });
  });

  it("rejects unsupported file types", async () => {
    const formData = new FormData();

    const fakeFile = new File(
      ["not actually an image"],
      "food.txt",
      { type: "text/plain" }
    );

    formData.append("image", fakeFile);

    const request = new Request(
      "http://localhost:3000/api/food/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: "Only JPG, PNG and WEBP images are supported.",
    });
  });

  it("rejects images larger than 10 MB", async () => {
    const formData = new FormData();

    const oversizedImage = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "huge-food.jpg",
      { type: "image/jpeg" }
    );

    formData.append("image", oversizedImage);

    const request = new Request(
      "http://localhost:3000/api/food/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: "Image must be smaller than 10 MB.",
    });
  });
});