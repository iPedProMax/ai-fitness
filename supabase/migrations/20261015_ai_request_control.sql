-- LOCAL ONLY: review and apply separately. No providers are enabled by this migration.
-- All mutations require a trusted server credential. Never grant these RPCs to clients.
begin;

create table public.ai_runtime_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  paid_enabled boolean not null default false,
  daily_budget_micros bigint not null default 0 check (daily_budget_micros >= 0),
  monthly_budget_micros bigint not null default 0 check (monthly_budget_micros >= 0)
);
insert into public.ai_runtime_policy(singleton) values (true);

create table public.ai_provider_policy (
  provider text primary key check (provider in ('gemini', 'groq')),
  enabled boolean not null default false,
  free_tier_verified boolean not null default false,
  requests_per_minute integer not null default 0 check (requests_per_minute >= 0),
  requests_per_day integer not null default 0 check (requests_per_day >= 0),
  tokens_per_minute bigint not null default 0 check (tokens_per_minute >= 0),
  tokens_per_day bigint not null default 0 check (tokens_per_day >= 0),
  max_concurrent integer not null default 0 check (max_concurrent >= 0),
  cooldown_until timestamptz,
  -- Conservative worst-case charge for one bounded attempt, never refunded.
  cost_per_attempt_micros bigint not null default 0 check (cost_per_attempt_micros >= 0)
);
insert into public.ai_provider_policy(provider) values ('gemini'), ('groq');

create table public.ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (length(request_key) between 16 and 128),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('analysis', 'refinement')),
  claim uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  state text not null default 'running' check (state in ('running','complete')),
  attempted_providers text[] not null default '{}',
  response_status integer check (response_status between 200 and 599),
  response_body jsonb,
  primary key (user_id, request_key)
);
create table public.ai_provider_usage (
  provider text not null,
  window_kind text not null check (window_kind in ('minute','day','month')),
  window_start timestamptz not null,
  requests bigint not null default 0 check (requests >= 0),
  tokens bigint not null default 0 check (tokens >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  primary key(provider, window_kind, window_start)
);
create table public.ai_provider_attempts (
  user_id uuid not null,
  request_key text not null,
  provider text not null references public.ai_provider_policy(provider),
  lease_until timestamptz not null default (now()+interval '2 minutes'),
  settled boolean not null default false,
  primary key(user_id,request_key,provider),
  foreign key(user_id,request_key) references public.ai_requests(user_id,request_key) on delete cascade
);
create index ai_provider_attempts_inflight on public.ai_provider_attempts(provider,lease_until) where not settled;

alter table public.ai_runtime_policy enable row level security;
alter table public.ai_provider_policy enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_provider_usage enable row level security;
alter table public.ai_provider_attempts enable row level security;
revoke all on public.ai_runtime_policy, public.ai_provider_policy, public.ai_requests,
  public.ai_provider_usage, public.ai_provider_attempts from public, anon, authenticated, service_role;

-- Google's RPD boundary is Pacific midnight (DST aware), NOT user Manila
-- midnight or UTC budget midnight. Groq remains disabled; UTC day is only an
-- app cap for Groq until its account-specific reset semantics are verified.
create function public.ai_provider_window_start(p_provider text,p_window text,p_now timestamptz)
returns timestamptz language sql stable set search_path='' as $$
  select case when p_window='day' and p_provider='gemini'
    then date_trunc('day',p_now at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
    else date_trunc(p_window,p_now at time zone 'UTC') at time zone 'UTC' end;
$$;
revoke all on function public.ai_provider_window_start(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ai_provider_window_start(text,text,timestamptz) to service_role;

-- A global row lock serializes admission/accounting across every app instance.
-- It is intentionally simple at current application scale. No network calls occur
-- inside this transaction. Unique user/key records are permanent tombstones:
-- expiring a replay body MUST NOT allow that key to charge again.
create function public.control_ai_request(
  p_operation text, p_user_id uuid, p_key text, p_hash text default null,
  p_kind text default null, p_claim uuid default null, p_provider text default null,
  p_tokens bigint default null, p_status integer default null, p_body jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.ai_runtime_policy;
  r public.ai_requests;
  p public.ai_provider_policy;
  u public.ai_provider_usage;
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_limit integer;
  v_used integer;
  v_window text;
  v_start timestamptz;
  v_requests bigint;
  v_tokens bigint;
  v_cost bigint;
begin
  if p_operation is null or p_operation not in ('begin','attempt','finish','settle') then
    raise exception 'Invalid operation' using errcode='22023';
  end if;
  if p_user_id is null or p_key is null or length(p_key) not between 16 and 128 then
    raise exception 'Invalid AI request identity' using errcode = '22023';
  end if;
  select * into g from public.ai_runtime_policy where singleton for update;
  if not found then return '{"code":"AI_ACCOUNTING_UNAVAILABLE","status":503}'::jsonb; end if;
  select * into r from public.ai_requests where user_id=p_user_id and request_key=p_key;

  if p_operation = 'begin' then
    if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_kind is null or p_kind not in ('analysis','refinement') then
      raise exception 'Invalid AI request payload' using errcode = '22023';
    end if;
    if r.user_id is not null then
      if r.payload_hash <> p_hash or r.kind <> p_kind then
        return '{"code":"AI_KEY_CONFLICT","status":409}'::jsonb;
      end if;
      if r.created_at < now() - interval '24 hours' then
        -- Remove private cached results on access; retain the non-reusable key/hash.
        update public.ai_requests set response_body=null where user_id=p_user_id and request_key=p_key;
        return '{"code":"AI_REPLAY_EXPIRED","status":410}'::jsonb;
      end if;
      if r.state='complete' then
        return jsonb_build_object('replay',true,'status',r.response_status,'body',r.response_body);
      end if;
      -- Never transfer a claim after a crash/timeout: an upstream call may still run.
      return jsonb_build_object('code',case when r.created_at < now()-interval '2 minutes'
        then 'AI_REQUEST_INTERRUPTED' else 'AI_REQUEST_IN_PROGRESS' end,'status',409);
    end if;
    if not g.enabled or not exists(select 1 from public.ai_provider_policy
      where provider='gemini' and enabled and free_tier_verified and cost_per_attempt_micros=0
      and requests_per_minute>0 and requests_per_day>0 and tokens_per_minute>0 and tokens_per_day>0 and max_concurrent>0) then
      return '{"code":"AI_DISABLED","status":503}'::jsonb;
    end if;
    v_limit := case when p_kind='analysis' then 20 else 60 end;
    insert into public.ai_daily_usage as usage(user_id,usage_date,analyses_used,refinements_used)
      values(p_user_id,v_day,case when p_kind='analysis' then 1 else 0 end,
        case when p_kind='refinement' then 1 else 0 end)
      on conflict(user_id,usage_date) do update set
        analyses_used=usage.analyses_used+case when p_kind='analysis' then 1 else 0 end,
        refinements_used=usage.refinements_used+case when p_kind='refinement' then 1 else 0 end,
        updated_at=now()
      where (p_kind='analysis' and usage.analyses_used<20)
         or (p_kind='refinement' and usage.refinements_used<60)
      returning case when p_kind='analysis' then analyses_used else refinements_used end into v_used;
    if not found then
      return jsonb_build_object('code','AI_QUOTA_EXCEEDED','status',429,'remaining',0,
        'resetsAt',((v_day+1)::timestamp at time zone 'Asia/Manila'));
    end if;
    insert into public.ai_requests(user_id,request_key,payload_hash,kind)
      values(p_user_id,p_key,p_hash,p_kind) returning * into r;
    return jsonb_build_object('claim',r.claim);
  end if;

  if r.user_id is null or p_claim is null or r.claim<>p_claim or (r.state<>'running' and p_operation<>'settle')
      or r.created_at<now()-interval '2 minutes' then
    return '{"code":"AI_INVALID_CLAIM","status":503}'::jsonb;
  end if;
  if p_operation='finish' then
    if p_status is null or p_status not between 200 and 599 or p_body is null
       or octet_length(p_body::text)>1048576 then
      raise exception 'Invalid AI response' using errcode='22023';
    end if;
    update public.ai_requests set state='complete',response_status=p_status,response_body=p_body
      where user_id=p_user_id and request_key=p_key;
    return '{"ok":true}'::jsonb;
  end if;
  if p_operation='settle' then
    if p_status is null or p_status not between 200 and 599 then
      raise exception 'Invalid attempt outcome' using errcode='22023';
    end if;
    update public.ai_provider_attempts set settled=(p_status not in (499,504,520))
      where user_id=p_user_id and request_key=p_key and provider=p_provider and not settled;
    if not found then return '{"code":"AI_INVALID_CLAIM","status":503}'::jsonb; end if;
    if p_status in (408,429,500,502,503,504) then
      update public.ai_provider_policy set cooldown_until=greatest(coalesce(cooldown_until,now()),now()+interval '30 seconds')
        where provider=p_provider;
    end if;
    return '{"ok":true}'::jsonb;
  end if;
  if p_operation<>'attempt' then raise exception 'Invalid operation' using errcode='22023'; end if;
  if not g.enabled then return '{"code":"AI_DISABLED","status":503}'::jsonb; end if;
  select * into p from public.ai_provider_policy where provider=p_provider;
  -- Paid execution is deliberately unavailable in this release, even if someone
  -- toggles paid_enabled. A future release must validate pricing before enabling it.
  if not found or not p.enabled or not p.free_tier_verified or p.cost_per_attempt_micros<>0
      or p_tokens is null or p_tokens<=0 then
    return '{"code":"AI_PROVIDER_DISABLED","status":503}'::jsonb;
  end if;
  if p.cooldown_until>now() then
    return jsonb_build_object('code','AI_PROVIDER_COOLDOWN','status',503,
      'retryAfter',ceil(extract(epoch from (p.cooldown_until-now())))::integer);
  end if;
  if (select count(*) from public.ai_provider_attempts where provider=p_provider
      and not settled and lease_until>now())>=p.max_concurrent then
    return '{"code":"AI_PROVIDER_CONCURRENCY","status":503,"retryAfter":30}'::jsonb;
  end if;
  if cardinality(r.attempted_providers)>=2 or p_provider=any(r.attempted_providers) then
    return '{"code":"AI_ATTEMPT_LIMIT","status":503}'::jsonb;
  end if;
  foreach v_window in array array['minute','day','month'] loop
    v_start := public.ai_provider_window_start(p_provider,v_window,now());
    select * into u from public.ai_provider_usage
      where provider=p_provider and window_kind=v_window and window_start=v_start;
    v_requests := coalesce(u.requests,0)+1;
    v_tokens := coalesce(u.tokens,0)+p_tokens;
    v_cost := coalesce(u.cost_micros,0)+p.cost_per_attempt_micros;
    if (v_window='minute' and (v_requests>p.requests_per_minute or v_tokens>p.tokens_per_minute))
      or (v_window='day' and (v_requests>p.requests_per_day or v_tokens>p.tokens_per_day)) then
      return '{"code":"AI_GLOBAL_LIMIT","status":503}'::jsonb;
    end if;
  end loop;
  foreach v_window in array array['day','month'] loop
    v_start := public.ai_provider_window_start('_global',v_window,now());
    select cost_micros into v_cost from public.ai_provider_usage
      where provider='_global' and window_kind=v_window and window_start=v_start;
    if (v_window='day' and coalesce(v_cost,0)+p.cost_per_attempt_micros>g.daily_budget_micros)
      or (v_window='month' and coalesce(v_cost,0)+p.cost_per_attempt_micros>g.monthly_budget_micros) then
      return '{"code":"AI_GLOBAL_BUDGET","status":503}'::jsonb;
    end if;
  end loop;
  -- Only increment after ALL windows pass. Ambiguous/failed calls retain the
  -- reservation: never release capacity while an upstream call may still run.
  foreach v_window in array array['minute','day','month'] loop
    v_start := public.ai_provider_window_start(p_provider,v_window,now());
    insert into public.ai_provider_usage as usage(provider,window_kind,window_start,requests,tokens,cost_micros)
      values(p_provider,v_window,v_start,1,p_tokens,p.cost_per_attempt_micros)
      on conflict(provider,window_kind,window_start) do update set
        requests=usage.requests+1,tokens=usage.tokens+p_tokens,cost_micros=usage.cost_micros+p.cost_per_attempt_micros;
  end loop;
  foreach v_window in array array['day','month'] loop
    v_start := public.ai_provider_window_start('_global',v_window,now());
    insert into public.ai_provider_usage as usage(provider,window_kind,window_start,cost_micros)
      values('_global',v_window,v_start,p.cost_per_attempt_micros)
      on conflict(provider,window_kind,window_start) do update set
        cost_micros=usage.cost_micros+p.cost_per_attempt_micros;
  end loop;
  update public.ai_requests set attempted_providers=array_append(attempted_providers,p_provider)
    where user_id=p_user_id and request_key=p_key;
  insert into public.ai_provider_attempts(user_id,request_key,provider) values(p_user_id,p_key,p_provider);
  return '{"ok":true}'::jsonb;
end;
$$;
revoke all on function public.control_ai_request(text,uuid,text,text,text,uuid,text,bigint,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.control_ai_request(text,uuid,text,text,text,uuid,text,bigint,integer,jsonb)
  to service_role;

-- Scheduled maintenance: call from trusted administration, never an HTTP client.
create function public.purge_ai_replay_bodies() returns void
language sql security definer set search_path='' as $$
  update public.ai_requests set response_body=null where created_at<now()-interval '24 hours' and response_body is not null;
  delete from public.ai_provider_usage where window_start<now()-interval '90 days';
  delete from public.ai_provider_attempts where lease_until<now()-interval '1 day';
$$;
revoke all on function public.purge_ai_replay_bodies() from public,anon,authenticated;
grant execute on function public.purge_ai_replay_bodies() to service_role;
commit;
