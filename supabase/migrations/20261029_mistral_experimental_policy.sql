-- Mistral experimental model. REVIEW/APPLY MANUALLY only when approved.
-- No Mistral outbound usage is enabled by this migration.
-- Free-plan eligibility and billing MUST be independently confirmed.
begin;
alter table public.ai_provider_policy
  drop constraint if exists ai_provider_policy_provider_check;
alter table public.ai_provider_policy
  add constraint ai_provider_policy_provider_check
  check (provider in ('gemini','gemini-3.8-flash','gemini-3.6-flash','groq','cloudflare','mistral'));
insert into public.ai_provider_policy(provider,enabled,free_tier_verified,cost_per_attempt_micros)
  values ('mistral',false,false,0)
  on conflict(provider) do nothing;
create or replace function public.control_ai_request(
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
      where provider in ('gemini','groq','cloudflare','mistral') and enabled and free_tier_verified and cost_per_attempt_micros=0
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
    -- A failed request with NO approved outbound attempt is provably local-only.
    -- Restore that user credit on its ORIGINAL Manila usage date, atomically
    -- with final response persistence. Any authorized provider attempt retains
    -- its credit even on errors/timeouts: the upstream call may have run.
    -- The running->complete claim transition prevents duplicate refunds.
    if p_status>=400 and cardinality(r.attempted_providers)=0 then
      update public.ai_daily_usage set
        analyses_used=analyses_used-case when r.kind='analysis' then 1 else 0 end,
        refinements_used=refinements_used-case when r.kind='refinement' then 1 else 0 end,
        updated_at=now()
      where user_id=p_user_id and usage_date=(r.created_at at time zone 'Asia/Manila')::date
        and ((r.kind='analysis' and analyses_used>0)
          or (r.kind='refinement' and refinements_used>0));
      if not found then
        raise exception 'AI credit refund invariant failed' using errcode='P0001';
      end if;
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
create or replace function public.list_free_gemini_models() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', q.provider,
  'enabled', q.reason is null,
  'reason', q.reason
) order by q.provider), '[]'::jsonb)
from (
  select p.provider,
    case
      when not g.enabled or not p.enabled or not p.free_tier_verified
        or p.cost_per_attempt_micros<>0 or p.requests_per_minute<=0
        or p.requests_per_day<=0 or p.tokens_per_minute<=0
        or p.tokens_per_day<=0 or p.max_concurrent<=0
        then 'Free-tier model not activated in staging'
      when p.cooldown_until>now() then 'Model temporarily cooling down'
      when coalesce((select requests from public.ai_provider_usage u
        where u.provider=p.provider and u.window_kind='day'
        and u.window_start=public.ai_provider_window_start(p.provider,'day',now())),0)>=p.requests_per_day
        then 'Application daily limit reached'
      when coalesce((select requests from public.ai_provider_usage u
        where u.provider=p.provider and u.window_kind='minute'
        and u.window_start=public.ai_provider_window_start(p.provider,'minute',now())),0)>=p.requests_per_minute
        then 'Application minute limit reached'
      else null
    end as reason
  from public.ai_provider_policy p
  cross join public.ai_runtime_policy g
  where g.singleton and p.provider in ('gemini','gemini-3.8-flash','gemini-3.6-flash','groq','cloudflare','mistral')
) q;
$$;
revoke all on function public.list_free_gemini_models() from public, anon, authenticated;
grant execute on function public.list_free_gemini_models() to service_role;
commit;