import {describe,expect,it} from "vitest";
import { adminUidAllowlist, verifyAccountActionInput } from "./admin-account-policy";
const id="550e8400-e29b-41d4-a716-446655440000";
const valid={targetId:id,operation:"reset",expectedEmail:"someone@example.com",typedEmail:"someone@example.com",confirmation:"RESET ACCOUNT",reason:"Confirmed by ticket 56789"};
describe("Y4 destructive account request guards",()=>{
  it("requires exact target email and matching phrase",()=>{
    expect(verifyAccountActionInput(valid).ok).toBe(true);
    expect(verifyAccountActionInput({...valid,typedEmail:"other@example.com"}).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,confirmation:"admin123"}).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,operation:"delete"}).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,operation:"delete",confirmation:"DELETE ACCOUNT"}).ok).toBe(true);
  });
  it("rejects weak, malformed or missing input",()=>{
    expect(verifyAccountActionInput(null).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,targetId:"oops"}).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,reason:"ok"}).ok).toBe(false);
    expect(verifyAccountActionInput({...valid,operation:"other"}).ok).toBe(false);
  });
  it("only permits valid UUIDs in admin allowlist",()=>{
    expect(adminUidAllowlist(`x, ${id.toUpperCase()}, another`)).toEqual([id]);
  });
});
