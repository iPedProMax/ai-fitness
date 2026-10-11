import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { authMock, reserveMock, readMock, geminiMock } = vi.hoisted(() => ({
  authMock: vi.fn(), reserveMock: vi.fn(), readMock: vi.fn(), geminiMock: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: authMock }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserveMock, getAiUsage: readMock }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { interactions = { create: geminiMock }; },
}));

import { POST as photo } from "@/app/api/food/analyze/route";
import { POST as refine } from "@/app/api/food/refine/route";
import { POST as text } from "@/app/api/food/text/route";
import { GET as usage } from "@/app/api/ai/usage/route";

function photoRequest() {
  const form = new FormData();
  form.append("images", new File(["image"], "meal.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/food/analyze", { method: "POST", body: form });
}
function textRequest() {
  return new Request("http://localhost/api/food/text", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "200 g cooked rice" }),
  });
}
function refineRequest(clarificationId = "meat_type") {
  return new Request("http://localhost/api/food/refine", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis: {
        foods: [{ name: "Pancit", estimatedGrams: 250, calories: 380,
          protein: 10, carbs: 55, fat: 13, confidence: 0.75,
          scaleReadingGrams: clarificationId === "tare_status_0" ? 200 : undefined }],
        totalCalories: 380, notes: "", clarifications: [{
          id: clarificationId, foodIndex: 0,
          question: "Which type?", options: clarificationId === "tare_status_0"
            ? ["Yes", "No", "Not sure"] : ["Chicken", "Pork"],
        }],
      },
      clarificationId,
      answer: clarificationId === "tare_status_0" ? "Yes" : "Chicken",
    }),
  });
}
const denied = () => NextResponse.json({ error: "Limit reached" }, { status: 429 });

describe("AI quota integration boundaries", () => {
  beforeEach(() => {
    authMock.mockReset(); authMock.mockResolvedValue(null);
    reserveMock.mockReset(); reserveMock.mockResolvedValue(denied());
    readMock.mockReset(); geminiMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("validates photo uploads without spending any analysis", async () => {
    const response = await photo(new Request("http://localhost/api/food/analyze", {
      method: "POST", body: new FormData(),
    }));
    expect(response.status).toBe(400);
    expect(reserveMock).not.toHaveBeenCalled();
  });

  it("blocks photo Gemini analysis at the limit", async () => {
    const response = await photo(photoRequest());
    expect(response.status).toBe(429);
    expect(reserveMock).toHaveBeenCalledWith("analysis");
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("blocks text Gemini analysis at the limit", async () => {
    const response = await text(textRequest());
    expect(response.status).toBe(429);
    expect(reserveMock).toHaveBeenCalledWith("analysis");
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("blocks Gemini-powered refinements at the separate daily limit", async () => {
    const response = await refine(refineRequest());
    expect(response.status).toBe(429);
    expect(reserveMock).toHaveBeenCalledWith("refinement");
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("does not charge a deterministic scale-tare answer", async () => {
    const response = await refine(refineRequest("tare_status_0"));
    expect(response.status).toBe(200);
    expect(reserveMock).not.toHaveBeenCalled();
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("requires login before exposing the remaining allowance", async () => {
    authMock.mockResolvedValueOnce(NextResponse.json({ error: "Login required" }, { status: 401 }));
    expect((await usage()).status).toBe(401);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("returns the user's remaining allowance when authenticated", async () => {
    readMock.mockResolvedValue(NextResponse.json({ remaining: 19, limit: 20 }));
    expect((await usage()).status).toBe(200);
    expect(readMock).toHaveBeenCalledOnce();
  });
});