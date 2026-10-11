-- AI Fitness: server-enforced AI allowance. Run once in Supabase SQL Editor.
-- 20 new photo/text AI analyses per Manila calendar day.
-- 60 Gemini-powered refinement calls per Manila calendar day, independently
-- capped to prevent unlimited clarification requests. These do NOT use the
-- 20-analysis allowance. Manual meal logging does not call either function.
-- IMPORTANT: The web API must invoke reserve_ai_usage BEFORE calling Gemini.

begin;

create table public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  analyses_used integer not null default 0
    check (analyses_used between 0 and 20),
  refinements_used integer not null default 0
    check (refinements_used between 0 and 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- No direct client reads/writes. Only the narrowly scoped RPCs below may
-- access this table, and they always derive the user ID from the JWT.
alter table public.ai_daily_usage enable row level security;
revoke all on table public.ai_daily_usage from public, anon, authenticated;

create function public.reserve_ai_usage(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_resets_at timestamptz := (
    ((now() at time zone 'Asia/Manila')::date + 1)::timestamp
    at time zone 'Asia/Manila'
  );
  v_analyses integer;
  v_refinements integer;
  v_allowed boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_kind not in ('analysis', 'refinement') or p_kind is null then
    raise exception 'Invalid AI usage kind' using errcode = '22023';
  end if;

  -- A single atomic UPSERT is the concurrency boundary. At the cap,
  -- the WHERE clause rejects additional increments, even when requests race.
  insert into public.ai_daily_usage as usage (
    user_id, usage_date, analyses_used, refinements_used
  )
  values (
    v_user_id,
    v_day,
    case when p_kind = 'analysis' then 1 else 0 end,
    case when p_kind = 'refinement' then 1 else 0 end
  )
  on conflict (user_id, usage_date) do update
    set analyses_used = usage.analyses_used +
      case when p_kind = 'analysis' then 1 else 0 end,
        refinements_used = usage.refinements_used +
      case when p_kind = 'refinement' then 1 else 0 end,
        updated_at = now()
  where
    (p_kind = 'analysis' and usage.analyses_used < 20)
    or
    (p_kind = 'refinement' and usage.refinements_used < 60)
  returning analyses_used, refinements_used
    into v_analyses, v_refinements;

  v_allowed := found;

  if not v_allowed then
    select analyses_used, refinements_used
      into v_analyses, v_refinements
    from public.ai_daily_usage
    where user_id = v_user_id and usage_date = v_day;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'kind', p_kind,
    'limit', case when p_kind = 'analysis' then 20 else 60 end,
    'used', case when p_kind = 'analysis' then v_analyses else v_refinements end,
    'remaining', case when p_kind = 'analysis' then 20 - v_analyses else 60 - v_refinements end,
    'resetsAt', v_resets_at
  );
end;
$$;

create function public.get_ai_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_resets_at timestamptz := (
    ((now() at time zone 'Asia/Manila')::date + 1)::timestamp
    at time zone 'Asia/Manila'
  );
  v_analyses integer := 0;
  v_refinements integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select analyses_used, refinements_used
    into v_analyses, v_refinements
  from public.ai_daily_usage
  where user_id = v_user_id and usage_date = v_day;

  v_analyses := coalesce(v_analyses, 0);
  v_refinements := coalesce(v_refinements, 0);

  return jsonb_build_object(
    'limit', 20,
    'used', v_analyses,
    'remaining', 20 - v_analyses,
    'refinementLimit', 60,
    'refinementsUsed', v_refinements,
    'resetsAt', v_resets_at
  );
end;
$$;

-- PostgreSQL functions are executable by PUBLIC by default; override that.
revoke all on function public.reserve_ai_usage(text) from public, anon;
revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.reserve_ai_usage(text) to authenticated;
grant execute on function public.get_ai_usage() to authenticated;

commit;
