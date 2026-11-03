-- KHALORIES Phase Y4: operator audit and atomic tracking-data reset.
-- REVIEW against target Supabase schema before manually applying. Never auto-executed by installer.
-- Run as the database owner in SQL Editor; no user data is deleted by applying this migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.khalories_admin_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('reset','delete')),
  outcome text NOT NULL CHECK (outcome IN ('started','completed','failed')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 12 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.khalories_admin_account_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.khalories_admin_account_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.khalories_admin_account_audit TO service_role;

-- Return total Storage ownership matches + references from meals. This is a conservative guard,
-- not a download or automatic file deletion. Storage API must be used to remove photos.
CREATE OR REPLACE FUNCTION public.khalories_admin_user_storage_count(p_user_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    (SELECT count(*) FROM storage.objects AS o
       WHERE o.owner_id = p_user_id::text OR o.name LIKE (p_user_id::text || '/%'))
    + (SELECT count(*) FROM public.meals AS m
       WHERE m.user_id = p_user_id AND m.thumbnail_path IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.khalories_admin_user_storage_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khalories_admin_user_storage_count(uuid) TO service_role;

-- Reset only user-owned food/fitness data. Preserves authentication, session, AI request
-- history, daily AI credit quota and provider accounting so limits cannot be evaded.
-- All DELETEs and audit entry run in one PostgreSQL transaction (function call).
CREATE OR REPLACE FUNCTION public.khalories_admin_reset_tracking(
  p_actor_user_id uuid, p_target_user_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_actor_user_id IS NULL OR p_target_user_id IS NULL OR p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'invalid actor or target';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 12 OR char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'request reason required';
  END IF;
  IF public.khalories_admin_user_storage_count(p_target_user_id) <> 0 THEN
    RAISE EXCEPTION 'storage objects must be handled first';
  END IF;
  -- Restrict accidental repeated actions by target and actor within 60 seconds.
  IF EXISTS (SELECT 1 FROM public.khalories_admin_account_audit
    WHERE actor_user_id = p_actor_user_id AND target_user_id = p_target_user_id
      AND created_at > now() - interval '60 seconds') THEN
    RAISE EXCEPTION 'recent account operation detected';
  END IF;

  DELETE FROM public.meal_items WHERE user_id = p_target_user_id;
  DELETE FROM public.meals WHERE user_id = p_target_user_id;
  DELETE FROM public.activities WHERE user_id = p_target_user_id;
  DELETE FROM public.weight_entries WHERE user_id = p_target_user_id;
  DELETE FROM public.fitness_goals WHERE user_id = p_target_user_id;
  DELETE FROM public.water_entries WHERE user_id = p_target_user_id;
  DELETE FROM public.meal_templates WHERE user_id = p_target_user_id;
  DELETE FROM public.user_preferences WHERE user_id = p_target_user_id;
  DELETE FROM public.user_barcode_foods WHERE user_id = p_target_user_id;
  INSERT INTO public.khalories_admin_account_audit(actor_user_id,target_user_id,action,outcome,reason)
    VALUES (p_actor_user_id,p_target_user_id,'reset','completed',p_reason);
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.khalories_admin_reset_tracking(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khalories_admin_reset_tracking(uuid,uuid,text) TO service_role;
COMMIT;
