-- AI FITNESS: OPTIONAL recipes/favorites + water records.
-- MANUAL REVIEW ONLY. NEVER automatically run against your production Supabase database.
-- Apply in a SEPARATE staging Supabase project first. RLS prevents cross-user access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.meal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  kind text NOT NULL CHECK (kind IN ('favorite','recipe')),
  analysis_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,title,kind)
);
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meal_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meal_templates TO authenticated;
DROP POLICY IF EXISTS meal_templates_owner_select ON public.meal_templates;
CREATE POLICY meal_templates_owner_select ON public.meal_templates FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS meal_templates_owner_insert ON public.meal_templates;
CREATE POLICY meal_templates_owner_insert ON public.meal_templates FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS meal_templates_owner_update ON public.meal_templates;
CREATE POLICY meal_templates_owner_update ON public.meal_templates FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS meal_templates_owner_delete ON public.meal_templates;
CREATE POLICY meal_templates_owner_delete ON public.meal_templates FOR DELETE TO authenticated USING (user_id=(select auth.uid()));
CREATE INDEX IF NOT EXISTS meal_templates_user_idx ON public.meal_templates(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.water_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on date NOT NULL,
  amount_ml integer NOT NULL CHECK (amount_ml BETWEEN 50 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.water_entries FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.water_entries TO authenticated;
DROP POLICY IF EXISTS water_entries_owner_select ON public.water_entries;
CREATE POLICY water_entries_owner_select ON public.water_entries FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS water_entries_owner_insert ON public.water_entries;
CREATE POLICY water_entries_owner_insert ON public.water_entries FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS water_entries_owner_delete ON public.water_entries;
CREATE POLICY water_entries_owner_delete ON public.water_entries FOR DELETE TO authenticated USING (user_id=(select auth.uid()));
CREATE INDEX IF NOT EXISTS water_entries_user_day_idx ON public.water_entries(user_id,logged_on DESC);
-- Full saved-meal nutrition edits are atomic and tied to auth.uid().
CREATE OR REPLACE FUNCTION public.replace_saved_meal_nutrition(p_meal_id uuid,p_analysis jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_owner uuid := (select auth.uid());
DECLARE v_food jsonb;
DECLARE v_protein numeric := 0; v_carbs numeric := 0; v_fat numeric := 0;
BEGIN
 IF v_owner IS NULL OR p_analysis IS NULL OR jsonb_typeof(p_analysis->'foods') <> 'array'
    OR jsonb_array_length(p_analysis->'foods') NOT BETWEEN 1 AND 10
    OR p_analysis->>'totalCalories' IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.meals WHERE id=p_meal_id AND user_id=v_owner FOR UPDATE) THEN RETURN false; END IF;
 FOR v_food IN SELECT value FROM jsonb_array_elements(p_analysis->'foods') AS f(value) LOOP
   IF length(v_food->>'name') NOT BETWEEN 1 AND 120
     OR (v_food->>'calories')::numeric < 0 OR (v_food->>'calories')::numeric > 100000
   THEN RETURN false; END IF;
   v_protein := v_protein + (v_food->>'protein')::numeric;
   v_carbs := v_carbs + (v_food->>'carbs')::numeric;
   v_fat := v_fat + (v_food->>'fat')::numeric;
 END LOOP;
 UPDATE public.meals SET analysis_snapshot=p_analysis, total_calories=(p_analysis->>'totalCalories')::numeric,
   total_protein=v_protein,total_carbs=v_carbs,total_fat=v_fat,
   notes=left(coalesce(p_analysis->>'notes','Manual nutrition correction.'),1000)
 WHERE id=p_meal_id AND user_id=v_owner;
 DELETE FROM public.meal_items WHERE meal_id=p_meal_id AND user_id=v_owner;
 INSERT INTO public.meal_items(meal_id,user_id,name,estimated_grams,calories,protein,carbs,fat,confidence,weight_source,nutrition_source)
 SELECT p_meal_id,v_owner,left(value->>'name',120),coalesce((value->>'estimatedGrams')::numeric,0),
 (value->>'calories')::numeric,(value->>'protein')::numeric,(value->>'carbs')::numeric,
 (value->>'fat')::numeric,1,null,null
 FROM jsonb_array_elements(p_analysis->'foods') AS f(value);
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.replace_saved_meal_nutrition(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_saved_meal_nutrition(uuid,jsonb) TO authenticated;
COMMIT;
