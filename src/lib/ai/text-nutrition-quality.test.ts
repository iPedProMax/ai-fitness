import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, reserve, getProvider, generate } = vi.hoisted(() => ({
  auth: vi.fn(), reserve: vi.fn(), getProvider: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/ai-usage", () => ({ reserveAiUsage: reserve }));
vi.mock("./provider", () => ({ getAiProvider: getProvider }));
import { POST } from "@/app/api/food/text/route";
const rice = {name:"Cooked white rice", estimatedGrams:100, calories:130,
  protein:3, carbs:28, fat:0.3, confidence:0.7,
  brandStatus:"NOT_RELEVANT",varietyStatus:"NOT_RELEVANT",materialUncertaintyPresent:false};
function data(food:typeof rice) {return {foods:[food],totalCalories:food.calories,notes:"Approximate",clarifications:[]}}
function request() {return new Request("http://localhost/api/food/text",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({description:"100 g cooked white rice",model:"mistral"})});}
beforeEach(()=>{
  auth.mockReset().mockResolvedValue(null);
  reserve.mockReset().mockResolvedValue(null);
  generate.mockReset();
  getProvider.mockReset().mockReturnValue({id:"mistral",enabled:true,available:true,
    capabilities:{text:true,vision:false,maxImages:0,structuredJson:true},generate});
});
describe("cloud Text AI manual nutrition plausibility gate",()=>{
  it("keeps a plausible rice estimate",async()=>{
    generate.mockResolvedValue({outputText:JSON.stringify(data(rice))});
    const r=await POST(request());
    expect(r.status).toBe(200);
    expect((await r.json()).foods[0].name).toBe("Cooked white rice");
    expect(reserve).toHaveBeenCalledExactlyOnceWith("analysis");
    expect(generate).toHaveBeenCalledOnce();
  });
  it("rejects an extreme calorie/macro contradiction",async()=>{
    const food={...rice,name:"Oats",calories:377,protein:7,carbs:4,fat:1};
    generate.mockResolvedValue({outputText:JSON.stringify(data(food))});
    const r=await POST(request());
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({code:"AI_NUTRITION_INCONSISTENT"});
    expect(reserve).toHaveBeenCalledExactlyOnceWith("analysis");
  });
  it.each(["weight","confidence"])("rejects zero %s",async field=>{
    const food=field==="weight"?{...rice,estimatedGrams:0}:{...rice,confidence:0};
    generate.mockResolvedValue({outputText:JSON.stringify(data(food))});
    const r=await POST(request());
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({code:"AI_NUTRITION_INCONSISTENT"});
  });
  it("does not reject legitimate zero-calorie water",async()=>{
    const water={...rice,name:"Water",estimatedGrams:250,calories:0,protein:0,carbs:0,fat:0};
    generate.mockResolvedValue({outputText:JSON.stringify(data(water))});
    const r=await POST(request());
    expect(r.status).toBe(200);
    expect((await r.json()).foods[0].calories).toBe(0);
  });
});