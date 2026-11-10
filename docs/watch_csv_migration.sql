-- Apply to staging before testing watch CSV import; later apply to production during launch.
-- Keeps existing manual activity rows intact. No service-role bypass or new RLS policies.
alter table public.activities add column if not exists import_source text;
alter table public.activities add column if not exists import_key text;
create unique index if not exists activities_user_import_dedupe on public.activities (user_id, import_source, import_key);
