import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
const root=new URL("./",import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,root),"utf8");
describe("phase 5 route and dashboard wiring",()=>{
  it("shows targets on dashboard without subtracting exercise",()=>{
    const dashboard=read("../../components/today-overview.tsx");
    expect(dashboard).toContain('from("fitness_goals")');
    expect(dashboard).toContain("Only food intake counts toward these targets");
    expect(dashboard).toContain('href="/goals"');
  });
  it("links protected goals and reports routes",()=>{
    const shell=read("../../components/app-shell.tsx");
    const protectedPage=read("../../lib/supabase/protected-app-page.ts");
    expect(shell).toContain('href: "/goals"');
    expect(shell).toContain('href: "/reports"');
    expect(protectedPage).toContain('pathname === "/goals"');
    expect(protectedPage).toContain('pathname === "/reports"');
  });
});
