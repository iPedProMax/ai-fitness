-- DISABLED-BY-DEFAULT optional text providers. Apply ONLY to verified staging DB after review.
-- Do not mark a provider free_tier_verified=true solely because its local cost is set to zero.
-- Confirm upstream account has hard $0 spending guarantees BEFORE enabling.
begin;
alter table public.ai_provider_policy drop constraint if exists ai_provider_policy_provider_check;
alter table public.ai_provider_policy add constraint ai_provider_policy_provider_check
 check (provider in ('gemini','gemini-3.8-flash','gemini-3.6-flash','groq','cloudflare','mistral','ollama-local','openrouter','zai','siliconflow','huggingface','cerebras'));
insert into public.ai_provider_policy
(provider,enabled,free_tier_verified,cost_per_attempt_micros,requests_per_minute,requests_per_day,tokens_per_minute,tokens_per_day,max_concurrent)
values
('openrouter',false,false,0,2,20,25000,200000,1),
('zai',false,false,0,1,10,25000,200000,1),
('siliconflow',false,false,0,1,10,25000,200000,1),
('huggingface',false,false,0,1,10,25000,200000,1),
('cerebras',false,false,0,2,20,25000,200000,1)
on conflict(provider) do nothing;
create or replace function public.list_free_gemini_models() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'id', q.provider, 'enabled', q.reason is null, 'reason', q.reason
) order by q.provider), '[]'::jsonb)
from (
 select p.provider,
  case
   when not g.enabled or not p.enabled or not p.free_tier_verified or p.cost_per_attempt_micros<>0
    or p.requests_per_minute<=0 or p.requests_per_day<=0 or p.tokens_per_minute<=0
    or p.tokens_per_day<=0 or p.max_concurrent<=0
    then 'Free-tier model not activated in staging'
   when p.cooldown_until>now() then 'Model temporarily cooling down'
   when coalesce((select requests from public.ai_provider_usage u where u.provider=p.provider
    and u.window_kind='day' and u.window_start=public.ai_provider_window_start(p.provider,'day',now())),0)>=p.requests_per_day
    then 'Application daily limit reached'
   when coalesce((select requests from public.ai_provider_usage u where u.provider=p.provider
    and u.window_kind='minute' and u.window_start=public.ai_provider_window_start(p.provider,'minute',now())),0)>=p.requests_per_minute
    then 'Application minute limit reached'
   else null end as reason
 from public.ai_provider_policy p cross join public.ai_runtime_policy g
 where g.singleton and p.provider in ('gemini','gemini-3.8-flash','gemini-3.6-flash','groq','cloudflare','mistral','ollama-local','openrouter','zai','siliconflow','huggingface','cerebras')
) q;
$$;
revoke all on function public.list_free_gemini_models() from public,anon,authenticated;
grant execute on function public.list_free_gemini_models() to service_role;
commit;