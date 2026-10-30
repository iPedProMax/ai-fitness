-- AI FITNESS: OPTIONAL STAGING REVIEW ONLY. DO NOT APPLY AUTOMATICALLY.
-- Shared per-user and global rate caps for Open Food Facts proxy.
-- Needed before enabling /api/food/catalog for public Vercel production.
-- This migration does not modify AI credits, provider policy, or food data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.food_catalog_rate_usage (
  scope text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('barcode','search')),
  window_kind text NOT NULL CHECK (window_kind IN ('minute','day')),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count>=0),
  PRIMARY KEY(scope,kind,window_kind,window_start)
);
ALTER TABLE public.food_catalog_rate_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.food_catalog_rate_usage FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admit_food_catalog_lookup(p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_user_scope text;
  v_m timestamptz := date_trunc('minute',now());
  v_d timestamptz := date_trunc('day',now());
  v_pm integer;
  v_gm integer;
  v_pd integer;
  v_count integer;
  v_next integer;
BEGIN
  IF v_user IS NULL OR p_kind NOT IN ('barcode','search') OR p_kind IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'retry_after',60);
  END IF;
  -- Supabase per-app upstream IP limit has a buffer below 15 barcode / 10 search requests/min.
  v_pm := CASE WHEN p_kind='barcode' THEN 3 ELSE 2 END;
  v_gm := CASE WHEN p_kind='barcode' THEN 10 ELSE 6 END;
  v_pd := CASE WHEN p_kind='barcode' THEN 40 ELSE 15 END;
  v_user_scope:='user:'||v_user::text;
  -- Global lock per lookup type prevents races across Vercel instances.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('fitness-catalog-v1'),pg_catalog.hashtext(p_kind));
  SELECT request_count INTO v_count FROM public.food_catalog_rate_usage
    WHERE scope=v_user_scope AND kind=p_kind AND window_kind='minute' AND window_start=v_m;
  IF COALESCE(v_count,0)>=v_pm THEN
    v_next := GREATEST(1,CEIL(EXTRACT(EPOCH FROM (v_m+interval '1 minute'-now())))::integer);
    RETURN jsonb_build_object('allowed',false,'retry_after',v_next);
  END IF;
  SELECT request_count INTO v_count FROM public.food_catalog_rate_usage
    WHERE scope='global' AND kind=p_kind AND window_kind='minute' AND window_start=v_m;
  IF COALESCE(v_count,0)>=v_gm THEN
    v_next := GREATEST(1,CEIL(EXTRACT(EPOCH FROM (v_m+interval '1 minute'-now())))::integer);
    RETURN jsonb_build_object('allowed',false,'retry_after',v_next);
  END IF;
  SELECT request_count INTO v_count FROM public.food_catalog_rate_usage
    WHERE scope=v_user_scope AND kind=p_kind AND window_kind='day' AND window_start=v_d;
  IF COALESCE(v_count,0)>=v_pd THEN
    v_next := GREATEST(1,CEIL(EXTRACT(EPOCH FROM (v_d+interval '1 day'-now())))::integer);
    RETURN jsonb_build_object('allowed',false,'retry_after',v_next);
  END IF;
  INSERT INTO public.food_catalog_rate_usage(scope,kind,window_kind,window_start,request_count)
    VALUES (v_user_scope,p_kind,'minute',v_m,1)
    ON CONFLICT(scope,kind,window_kind,window_start) DO UPDATE
    SET request_count=public.food_catalog_rate_usage.request_count+1;
  INSERT INTO public.food_catalog_rate_usage(scope,kind,window_kind,window_start,request_count)
    VALUES ('global',p_kind,'minute',v_m,1)
    ON CONFLICT(scope,kind,window_kind,window_start) DO UPDATE
    SET request_count=public.food_catalog_rate_usage.request_count+1;
  INSERT INTO public.food_catalog_rate_usage(scope,kind,window_kind,window_start,request_count)
    VALUES (v_user_scope,p_kind,'day',v_d,1)
    ON CONFLICT(scope,kind,window_kind,window_start) DO UPDATE
    SET request_count=public.food_catalog_rate_usage.request_count+1;
  RETURN jsonb_build_object('allowed',true);
END;$$;
REVOKE ALL ON FUNCTION public.admit_food_catalog_lookup(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admit_food_catalog_lookup(text) TO authenticated;
COMMIT;
-- Operational cleanup (run periodically from a trusted scheduler, not inside each request):
-- DELETE FROM public.food_catalog_rate_usage WHERE window_start < now() - interval '3 days';
