-- Phase 4: manual exercise and activity tracking.
-- Run once in the SAME Supabase project used by AI Fitness.
-- Exercise entries do not call Gemini or consume ai_daily_usage credits.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  performed_at timestamptz not null,
  activity_type text not null check (activity_type in ('walking','running','cycling','strength_training','other')),
  intensity text not null check (intensity in ('light','moderate','vigorous')),
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  weight_kg numeric check (weight_kg between 20 and 500),
  calories_burned numeric check (calories_burned between 0 and 100000),
  calorie_source text not null check (calorie_source in ('estimated','reported','not_estimated')),
  notes text not null default '' check (char_length(notes) <= 280),
  constraint activities_calorie_source_consistency check (
    (calorie_source = 'not_estimated' and calories_burned is null)
    or (calorie_source in ('reported','estimated') and calories_burned is not null)
  )
);

create index if not exists activities_user_performed_idx
  on public.activities (user_id, performed_at desc);

alter table public.activities enable row level security;

-- Policies are idempotent so rerunning this migration is safe.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_select_own') then
    create policy activities_select_own on public.activities
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_insert_own') then
    create policy activities_insert_own on public.activities
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_delete_own') then
    create policy activities_delete_own on public.activities
      for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;

grant select, insert, delete on public.activities to authenticated;
revoke all on public.activities from anon;
