import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('growth upgrade wiring',()=>{
  it('connects report explorer to existing reports',()=>{expect(read('../app/reports/page.tsx')).toContain('<ReportExplorer days=');});
  it('adds activity insights and CSV import',()=>{const page=read('../app/activities/page.tsx');expect(page).toContain('<ActivityWeekly');expect(page).toContain('<WatchCsvImport />');});
  it('makes watch imports idempotent and authenticated',()=>{const file=read('../app/activities/import-watch.ts');expect(file).toContain('ignoreDuplicates:true');expect(file).toContain('supabase.auth.getUser()');});
  it('restricts admin server-side',()=>{const file=read('../app/admin/page.tsx');expect(file).toContain('KHALORIES_ADMIN_USER_IDS');expect(file).toContain('notFound()');expect(file).toContain('SUPABASE_SERVICE_ROLE_KEY');});
  it('keeps photo model options minimal',()=>{const picker=read('./ai-provider-picker.tsx');expect(picker).toContain('Google Gemini · primary');expect(picker).toContain('Groq Qwen Vision · 2 photos');expect(picker).not.toContain('Mistral 14B (Experimental)');});
});
