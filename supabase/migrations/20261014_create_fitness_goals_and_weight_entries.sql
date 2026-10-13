-- AI Fitness Phase 5: user-entered nutrition goals and optional weigh-ins.
-- Run in the same Supabase project as the activity and meal migrations.
-- No Gemini calls; no AI credit usage. Idempotent on repeat execution.
begin;

create table if not exists public.fitness_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('lose', 'maintain', 'gain')),
  calorie_target integer not null check (calorie_target between 800 and 6000),
  protein_target integer not null check (protein_target between 10 and 400),
  target_weight_kg numeric(5,1) check (target_weight_kg between 20 and 500),
  updated_at timestamptz not null default now()
);
alter table public.fitness_goals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fitness_goals' and policyname='fitness_goals_own_select') then
    create policy fitness_goals_own_select on public.fitness_goals for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fitness_goals' and policyname='fitness_goals_own_insert') then
    create policy fitness_goals_own_insert on public.fitness_goals for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fitness_goals' and policyname='fitness_goals_own_update') then
    create policy fitness_goals_own_update on public.fitness_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
grant select, insert, update on public.fitness_goals to authenticated;
revoke all on public.fitness_goals from anon;

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);
create index if not exists weight_entries_user_measured_idx on public.weight_entries (user_id, measured_on desc);
alter table public.weight_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weight_entries' and policyname='weight_entries_own_select') then
    create policy weight_entries_own_select on public.weight_entries for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weight_entries' and policyname='weight_entries_own_insert') then
    create policy weight_entries_own_insert on public.weight_entries for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weight_entries' and policyname='weight_entries_own_update') then
    create policy weight_entries_own_update on public.weight_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weight_entries' and policyname='weight_entries_own_delete') then
    create policy weight_entries_own_delete on public.weight_entries for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
grant select, insert, update, delete on public.weight_entries to authenticated;
revoke all on public.weight_entries from anon;
commit;
