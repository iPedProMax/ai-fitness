import { describe, expect, it } from "vitest";
import type { FoodAnalysis } from "@/lib/food-analysis";
import { applyDescriptionClarificationAnswers } from "./description-clarification";

const oats: FoodAnalysis = {
  foods: [{ name: "Plain Rolled Oats (Dried)", estimatedGrams: 71, calories: 247,
    protein: 8.3, carbs: 42.5, fat: 2.5, confidence: 0.85,
    brandStatus: "UNKNOWN_RELEVANT", varietyStatus: "UNKNOWN_RELEVANT",
    scaleReadingGrams: 70.6, weightSource: "AI_ESTIMATE" }],
  totalCalories: 247, notes: "Visual estimate", clarifications: [
    { id: "tare_status_0", foodIndex: 0, question: "The scale reads 70.6 g. Was the container tared before weighing?", options: ["Yes", "No", "Not sure"] },
    { id: "brand_0", foodIndex: 0, question: "Do you know the brand or exact product?", options: ["I don't know"], allowCustomAnswer: true },
    { id: "variety_0", foodIndex: 0, question: "Do you know the type or variety?", options: ["Instant oats", "Rolled oats"], allowCustomAnswer: true },
    { id: "sugar_0", foodIndex: 0, question: "Was sugar added?", options: ["Yes", "No"] },
  ],
};

describe("photo description can answer redundant clarifications", () => {
  it("resolves explicit Quaker/instant/tared claims from the reported oats case", () => {
    const actual = applyDescriptionClarificationAnswers(oats, "quaker oats instant oats and yes its tared");
    expect(actual.clarifications.map(q => q.id)).toEqual(["sugar_0"]);
    expect(actual.foods[0]).toMatchObject({ estimatedGrams: 70.6, brandStatus: "KNOWN", varietyStatus: "KNOWN", weightSource: "SCALE_MEASURED" });
    expect(actual.foods[0].calories).toBeCloseTo(247 * 70.6 / 71, 0);
    expect(actual.notes).toContain("User explicitly confirmed");
  });
  it("does not assume tared from weight alone", () => {
    const result = applyDescriptionClarificationAnswers(oats, "70.6g of quaker instant oats");
    expect(result.clarifications.map(q => q.id)).toEqual(["tare_status_0", "sugar_0"]);
    expect(result.foods[0].weightSource).toBe("AI_ESTIMATE");
  });
  it("retains ambiguous or conflicting variety and tare questions", () => {
    const result = applyDescriptionClarificationAnswers(oats, "Maybe instant oats or rolled oats, not sure if the bowl was tared");
    expect(result.clarifications.map(q => q.id)).toContain("tare_status_0");
    expect(result.clarifications.map(q => q.id)).toContain("brand_0");
    expect(result.clarifications.map(q => q.id)).toContain("variety_0");
    expect(result.foods[0].weightSource).toBe("AI_ESTIMATE");
  });
  it("does not treat an unrelated photo as the described branded food", () => {
    const other = { ...oats, foods: [{ ...oats.foods[0], name: "Broccoli" }] };
    const result = applyDescriptionClarificationAnswers(other, "quaker oats instant oats");
    expect(result.clarifications.map(q => q.id)).toContain("brand_0");
    expect(result.clarifications.map(q => q.id)).toContain("variety_0");
  });
  it("skips a clear negative tare answer but never assigns measured weight", () => {
    const actual = applyDescriptionClarificationAnswers(oats, "Quaker instant oats, bowl was not tared");
    expect(actual.clarifications.map(q => q.id)).not.toContain("tare_status_0");
    expect(actual.foods[0].weightSource).toBe("AI_ESTIMATE");
    expect(actual.foods[0].estimatedGrams).toBe(71);
  });
  it("keeps all questions without description and never mutates original input", () => {
    expect(applyDescriptionClarificationAnswers(oats, "")).toBe(oats);
    const before = JSON.stringify(oats);
    applyDescriptionClarificationAnswers(oats, "yes its tared");
    expect(JSON.stringify(oats)).toBe(before);
  });
  it("does not use a conflicting weight from the model as measured", () => {
    const result = applyDescriptionClarificationAnswers(oats, "Quaker instant oats, 100 g and yes its tared");
    expect(result.foods[0].weightSource).toBe("AI_ESTIMATE");
    expect(result.clarifications.map(q => q.id)).toContain("tare_status_0");
  });
  it("leaves multi-food responses unchanged to avoid applying details to wrong food", () => {
    const multi = { ...oats, foods: [...oats.foods, { ...oats.foods[0], name: "Rice" }] };
    expect(applyDescriptionClarificationAnswers(multi, "yes its tared")).toBe(multi);
  });
});
