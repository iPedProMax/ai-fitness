import { describe, expect, it } from "vitest";
import { EXTERNAL_WEB_FOOD_PROMPT } from "./external-gemini-import";
import { parseSmartWebFoodPaste } from "./ai-web-smart-paste.q413d";

describe("Q4.13D no-API Smart Paste", () => {
  it("works with ordinary bullet-list nutrition and advanced fields", () => {
    const result = parseSmartWebFoodPaste(`Food: Dry rolled oats
- Serving weight: 70.6 g
- Calories: ~265 kcal
- Protein: 9.2 g
- Carbs: 46.6 g
- Fat: 4.6 g
- Dietary fiber: 7 g
- Total sugar: 1 g
- Sodium: 2 mg
- Vitamin D: Unknown`);
    expect(result.format).toBe("plain-text");
    expect(result.items[0]).toMatchObject({name:"Dry rolled oats",grams:"70.6",calories:"265",protein:"9.2",carbs:"46.6",fat:"4.6",fiberG:"7",sugarG:"1",sodiumMg:"2"});
    expect(result.items[0].vitaminDMcg).toBeUndefined();
  });
  it("supports Markdown nutrition tables", () => {
    const r = parseSmartWebFoodPaste(`**Rolled oats**
| Nutrient | Amount |
| --- | --- |
| Calories | 265 kcal |
| Protein | 9.2 g |
| Carbs | 47.0 g |
| Fat | 5.1 g |
| Cholesterol | 0 mg |
| Calcium | 40 mg |`);
    expect(r.items[0]).toMatchObject({name:"Rolled oats",calories:"265",protein:"9.2",carbs:"47",fat:"5.1",cholesterolMg:"0",calciumMg:"40"});
  });
  it("extracts plainly written prose without forcing JSON or a table", () => {
    const r = parseSmartWebFoodPaste("This looks like dry rolled oats. The estimated meal is about 265 kcal, with 9.2 g protein, 46.6 g carbs and 4.6 g fat.");
    expect(r.items[0]).toMatchObject({name:"dry rolled oats",calories:"265",protein:"9.2",carbs:"46.6",fat:"4.6"});
    expect(r.items[0].grams).toBe("");
  });
  it("keeps existing JSON import and tolerates HTML-space artifacts from pasted answers", () => {
    const r = parseSmartWebFoodPaste('```json\n{\n&#x20;"foods":[{"name":"Oats","grams":null,"calories":null,"protein":null,"carbs":null,"fat":null}]\n}\n```');
    expect(r.format).toBe("json");
    expect(r.items[0]).toMatchObject({name:"Oats",grams:"",calories:"",protein:""});
  });
  it("does not assume a scale reading with a bowl is net food weight", () => {
    const r = parseSmartWebFoodPaste(`Food: Dry oats
Scale shows 70.6 g with a bowl present; tare status unknown.
Calories: 266 kcal
Protein: unknown`);
    expect(r.items[0].grams).toBe("");
    expect(r.items[0].calories).toBe("266");
    expect(r.warnings.join(" ")).toContain("tare");
  });
  it("does not import per-100g nutrition as consumed serving", () => {
    const r = parseSmartWebFoodPaste(`Food: Oats
Nutrition per 100 g:
Calories: 389 kcal
Protein: 16.9 g
Carbs: 66 g`);
    expect(r.items[0].calories).toBe("");
    expect(r.items[0].protein).toBe("");
    expect(r.warnings.join(" ")).toContain("per-100 g");
  });
  it("treats ranges and unsupported units as unknown, not arbitrary numbers", () => {
    const r = parseSmartWebFoodPaste(`Food: Oatmeal
Calories: 200-250 kcal
Protein: 6 to 9 g
Vitamin D: 40 IU
Sodium: 3 mg`);
    expect(r.items[0].calories).toBe("");
    expect(r.items[0].protein).toBe("");
    expect(r.items[0].vitaminDMcg).toBeUndefined();
    expect(r.items[0].sodiumMg).toBe("3");
  });
  it("keeps recognized food with unknown nutrition so reference autofill can be used", () => {
    const r = parseSmartWebFoodPaste(`It looks like dry rolled oats in the bowl. The 70.6 g scale weight cannot be confirmed as net weight.`);
    expect(r.items[0].name).toBe("dry rolled oats");
    expect(r.items[0].grams).toBe("");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("supports separately labeled foods without mixing macros", () => {
    const r = parseSmartWebFoodPaste(`Food 1: Oats
Calories: 265 kcal
Protein: 9 g
Food 2: Milk
Calories: 80 kcal
Protein: 5 g`);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({name:"Oats",calories:"265",protein:"9"});
    expect(r.items[1]).toMatchObject({name:"Milk",calories:"80",protein:"5"});
  });
  it("does not fabricate nutrition from unrelated prose or an empty paste", () => {
    expect(() => parseSmartWebFoodPaste("Thanks, I have the photo.")).toThrow();
    expect(() => parseSmartWebFoodPaste(" ")).toThrow();
  });
  it("asks the external AI for plain-language content, and preserves tare and nutrient coverage", () => {
    expect(EXTERNAL_WEB_FOOD_PROMPT).toContain("NOT JSON");
    expect(EXTERNAL_WEB_FOOD_PROMPT).toContain("tared");
    expect(EXTERNAL_WEB_FOOD_PROMPT).toContain("vitaminDMcg");
  });
});
