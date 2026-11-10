import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, reviewed, community } = vi.hoisted(() => ({
  auth: vi.fn(), reviewed: vi.fn(), community: vi.fn(),
}));
vi.mock("@/lib/food-api-auth", () => ({ requireFoodApiAuth: auth }));
vi.mock("@/lib/food-smart-catalog", () => ({ suggestReviewedFoods: reviewed }));
vi.mock("@/lib/ph-community-catalog", () => ({ findPhCommunityFood: community }));
import { GET } from "./route";
const sample = {barcode:"4800016552113",name:"Nissin Cup Noodles Seafood",brand:"Nissin",servingDescription:"40 g",calories100g:420,protein100g:10,carbs100g:60,fat100g:10};
beforeEach(() => { auth.mockReset().mockResolvedValue(null); reviewed.mockReset().mockResolvedValue([]); community.mockReset().mockReturnValue([sample]); });
afterEach(() => vi.clearAllMocks());
describe("Z3.6 Philippine food suggestions", () => {
  it("returns PH community matches without an external food request", async () => {
    const response = await GET(new Request("http://localhost/api/food/library/suggest?q=Nissin"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.communityFoods).toEqual([sample]);
    expect(community).toHaveBeenCalledWith("search", "Nissin");
  });
  it("keeps published labels separate and de-duplicates community records", async () => {
    reviewed.mockResolvedValue([sample]);
    const body = await (await GET(new Request("http://localhost/api/food/library/suggest?q=Nissin"))).json();
    expect(body.foods).toHaveLength(1);
    expect(body.communityFoods).toEqual([]);
  });
  it("does not return any suggestions for short queries", async () => {
    const body = await (await GET(new Request("http://localhost/api/food/library/suggest?q=ni"))).json();
    expect(body.communityFoods).toEqual([]);
    expect(community).not.toHaveBeenCalled();
  });
  it("enforces existing authentication", async () => {
    auth.mockResolvedValue(new Response("Forbidden", {status:401}));
    const response = await GET(new Request("http://localhost/api/food/library/suggest?q=Nissin"));
    expect(response.status).toBe(401);
    expect(community).not.toHaveBeenCalled();
  });
});
