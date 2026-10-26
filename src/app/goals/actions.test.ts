import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUserMock, fromMock, upsertMock, deleteMock, eqMock, revalidatePathMock } = vi.hoisted(() => {
  const getUserMock=vi.fn(); const upsertMock=vi.fn(); const eqMock=vi.fn();
  const deleteMock=vi.fn(()=>({eq:eqMock}));
  const fromMock=vi.fn(()=>({upsert:upsertMock,delete:deleteMock}));
  const revalidatePathMock=vi.fn();
  return {getUserMock,fromMock,upsertMock,deleteMock,eqMock,revalidatePathMock};
});
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:getUserMock},from:fromMock})}));
vi.mock("next/cache",()=>({revalidatePath:revalidatePathMock}));
import { saveFitnessGoal, saveWeightEntry, deleteWeightEntry } from "./actions";

const goal={goalType:"lose",calorieTarget:1900,proteinTarget:120,targetWeightKg:72};

describe("personal goals server actions",()=>{
  beforeEach(()=>{vi.clearAllMocks();getUserMock.mockResolvedValue({data:{user:{id:"account-1"}},error:null});upsertMock.mockResolvedValue({error:null});eqMock.mockReturnValueOnce({eq:vi.fn().mockResolvedValue({error:null})});});
  it("validates goals before writing",async()=>{
    expect((await saveFitnessGoal({...goal,calorieTarget:0})).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("requires login",async()=>{
    getUserMock.mockResolvedValue({data:{user:null},error:null});
    expect((await saveFitnessGoal(goal)).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("saves manually chosen targets under current user",async()=>{
    expect(await saveFitnessGoal(goal)).toEqual({ok:true});
    expect(fromMock).toHaveBeenCalledWith("fitness_goals");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({user_id:"account-1",calorie_target:1900,protein_target:120,goal_type:"lose"}),{onConflict:"user_id"});
  });
  it("records a dated weigh-in without touching AI usage",async()=>{
    expect(await saveWeightEntry({measuredOn:"2026-01-01",weightKg:81.5})).toEqual({ok:true});
    expect(fromMock).toHaveBeenCalledWith("weight_entries");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({user_id:"account-1",weight_kg:81.5}),{onConflict:"user_id,measured_on"});
    expect(fromMock).not.toHaveBeenCalledWith("ai_daily_usage");
  });
  it("rejects future dates and invalid ids",async()=>{
    expect((await saveWeightEntry({measuredOn:"2999-01-01",weightKg:80})).ok).toBe(false);
    expect((await deleteWeightEntry("not-uuid")).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("handles database failures without claiming success",async()=>{
    upsertMock.mockResolvedValue({error:{message:"DB down"}});
    expect((await saveFitnessGoal(goal)).ok).toBe(false);
  });
});
