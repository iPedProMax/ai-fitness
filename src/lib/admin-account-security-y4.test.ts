import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("Y4 account operations security boundaries",()=>{
  it("requires trusted admin auth, allowlist, recent sign-in and storage gate before mutation",()=>{
    const s=read("./admin-account-actions.ts");
    for(const fragment of ["await getAdminAccess()","hasAdminAppRole(user.app_metadata)","KHALORIES_ADMIN_USER_IDS","KHALORIES_ENABLE_ADMIN_ACCOUNT_ACTIONS","isFreshAdminLogin(actor.lastSignInAt)","findProtectedTarget(client, targetId, actor.id)","khalories_admin_user_storage_count","stored !== 0","khalories_admin_account_audit","khalories_admin_reset_tracking","auth.admin.deleteUser(targetId, false)"]){expect(s).toContain(fragment);}
    expect(s.indexOf("stored !== 0")).toBeLessThan(s.indexOf("auth.admin.deleteUser(targetId, false)"));
    expect(s).not.toContain("admin123");
    expect(s).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });
  it("no private admin api token or browser-controlled user ID is used for authorization",()=>{
    const s=read("../components/admin-account-controls.tsx");
    expect(s).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(s).not.toContain("createTrustedClient");
    expect(s).toContain("performAdminAccountAction");
  });
  it("uses a protected, dynamic server page",()=>{
    const s=read("../app/admin/analytics/users/[id]/page.tsx");
    expect(s).toContain('dynamic = "force-dynamic"');
    expect(s).toContain("if(!access.isAdmin)notFound()");
  });
});
