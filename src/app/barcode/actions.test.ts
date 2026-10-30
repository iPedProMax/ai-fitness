import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({getUser:vi.fn(),maybeSingle:vi.fn(),upsert:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:m.getUser},from:m.from})}));
import {findMyBarcodeFood,saveMyBarcodeFood} from "./actions";
const input={
  barcode:"4800016552113",name:"Nissin Seafood",brand:"Nissin",servingDescription:"40 g",packageDescription:"40 g",
  calories100g:425,protein100g:10,carbs100g:60,fat100g:null,source:"user_reviewed" as const,
};
beforeEach(()=>{
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({data:{user:{id:"signed-in-user"}},error:null});
  m.from.mockReturnValue({select:m.select,upsert:m.upsert});
  m.select.mockReturnValue({eq:m.eq});m.eq.mockReturnValue({eq:m.eq,maybeSingle:m.maybeSingle});
  m.maybeSingle.mockResolvedValue({data:null,error:null});
  m.upsert.mockResolvedValue({error:null});
});
describe("My Foods auth and RLS boundaries",()=>{
  it("rejects invalid barcodes without touching DB",async()=>{
    expect((await findMyBarcodeFood("ABC")).status).toBe("error");
    expect(m.from).not.toHaveBeenCalled();
  });
  it("never reads or writes for unauthenticated users",async()=>{
    m.getUser.mockResolvedValue({data:{user:null},error:null});
    expect((await findMyBarcodeFood(input.barcode)).status).toBe("error");
    expect((await saveMyBarcodeFood(input)).ok).toBe(false);
    expect(m.from).not.toHaveBeenCalled();
  });
  it("scopes reads to both the user and barcode",async()=>{
    const result=await findMyBarcodeFood(input.barcode);
    expect(result.status).toBe("not_found");
    expect(m.eq).toHaveBeenCalledWith("user_id","signed-in-user");
    expect(m.eq).toHaveBeenCalledWith("barcode",input.barcode);
  });
  it("upserts only the current user's validated values",async()=>{
    expect(await saveMyBarcodeFood(input)).toEqual({ok:true});
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:"signed-in-user",calories_100g:425,fat_100g:null}),{onConflict:"user_id,barcode"});
    const malicious={...input,user_id:"another-user"};
    expect((await saveMyBarcodeFood(malicious as typeof input)).ok).toBe(false);
    expect(m.upsert).toHaveBeenCalledTimes(1);
  });
  it("identifies a missing table in PostgREST schema cache",async()=>{
    m.maybeSingle.mockResolvedValue({data:null,error:{code:"PGRST205"}});
    expect((await findMyBarcodeFood(input.barcode)).status).toBe("not_configured");
    m.upsert.mockResolvedValue({error:{code:"PGRST205"}});
    expect(await saveMyBarcodeFood(input)).toMatchObject({ok:false,reason:"not_configured"});
  });  it("reports missing migration without claiming a successful save",async()=>{
    m.upsert.mockResolvedValue({error:{code:"42P01"}});
    expect(await saveMyBarcodeFood(input)).toMatchObject({ok:false,reason:"not_configured"});
  });
});
