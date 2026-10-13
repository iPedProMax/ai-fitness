-- Phase 4 follow-up: account-based visibility preferences.
-- Hiding exercise calories is a DISPLAY preference. Activity history is never deleted.
-- Calorie goals are not adjusted by this preference.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_exercise_calories boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_select_own') then
    create policy user_preferences_select_own on public.user_preferences
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_insert_own') then
    create policy user_preferences_insert_own on public.user_preferences
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_update_own') then
    create policy user_preferences_update_own on public.user_preferences
      for update to authenticated using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

grant select, insert, update on public.user_preferences to authenticated;
revoke all on public.user_preferences from anon;
