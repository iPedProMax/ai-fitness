import { describe, expect, it } from "vitest";
import { resolveLocalClarification } from "./local-clarification-resolver";
import { readFileSync } from "node:fs";

const analysis = {
  foods: [{ name:"Cooked white rice", estimatedGrams:200, calories:260, protein:5.4, carbs:57.2, fat:0.6,
    confidence:0.85, brandStatus:"UNKNOWN_RELEVANT" as const, varietyStatus:"UNKNOWN_RELEVANT" as const }],
  totalCalories:260, notes:"", clarifications:[
    {id:"brand_0",foodIndex:0,question:"Brand?",options:["I don't know"],allowCustomAnswer:true},
    {id:"variety_0",foodIndex:0,question:"Variety?",options:["Jasmine rice","I don't know"],allowCustomAnswer:true},
  ],
};
describe("cooldown-aware local clarification UI", () => {
  it("recognizes safe local answers while protecting material changes", () => {
    expect(resolveLocalClarification(analysis,"brand_0","I don't know")).not.toBeNull();
    expect(resolveLocalClarification(analysis,"brand_0","Royal Umbrella")).not.toBeNull();
    expect(resolveLocalClarification(analysis,"variety_0","I don't know")).not.toBeNull();
    expect(resolveLocalClarification(analysis,"variety_0","Brown rice")).toBeNull();
    expect(resolveLocalClarification(analysis,"brand_0","Sugar added")).toBeNull();
  });
  it("wires the card to per-answer gating instead of disabling the whole card", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url),"utf8");
    const card = readFileSync(new URL("../components/clarification-card.tsx", import.meta.url),"utf8");
    expect(page).toContain("isAnswerDisabled={(answer)");
    expect(page).toContain("!resolveLocalClarification(analysis, clarificationId, answer)");
    expect(card).toContain("isAnswerDisabled?.(option)");
    expect(card).toContain("isAnswerDisabled?.(trimmedCustomAnswer)");
    expect(page).not.toContain("clarification.id || cooldownSeconds > 0");
  });
});