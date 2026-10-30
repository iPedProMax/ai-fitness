-- AI FITNESS: user-reviewed barcode foods. REVIEW IN A SEPARATE STAGING SUPABASE PROJECT FIRST.
-- Does not publish community food data or change Open Food Facts records.
-- User entries are their own nutrition notes, not verified by the provider or AI Fitness.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_barcode_foods (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barcode text NOT NULL CHECK (barcode ~ '^[0-9]{8,14}$'),
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 110),
  brand text NOT NULL DEFAULT '' CHECK(length(brand)<=80),
  serving_description text NOT NULL DEFAULT '' CHECK(length(serving_description)<=80),
  package_description text NOT NULL DEFAULT '' CHECK(length(package_description)<=80),
  calories_100g numeric NOT NULL CHECK(calories_100g BETWEEN 0 AND 1200),
  protein_100g numeric CHECK(protein_100g BETWEEN 0 AND 100),
  carbs_100g numeric CHECK(carbs_100g BETWEEN 0 AND 100),
  fat_100g numeric CHECK(fat_100g BETWEEN 0 AND 100),
  source text NOT NULL CHECK(source IN ('user_reviewed','ai_reviewed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,barcode)
);
ALTER TABLE public.user_barcode_foods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_barcode_foods FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_barcode_foods TO authenticated;
DROP POLICY IF EXISTS user_barcode_foods_select_owner ON public.user_barcode_foods;
CREATE POLICY user_barcode_foods_select_owner ON public.user_barcode_foods FOR SELECT TO authenticated
  USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS user_barcode_foods_insert_owner ON public.user_barcode_foods;
CREATE POLICY user_barcode_foods_insert_owner ON public.user_barcode_foods FOR INSERT TO authenticated
  WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS user_barcode_foods_update_owner ON public.user_barcode_foods;
CREATE POLICY user_barcode_foods_update_owner ON public.user_barcode_foods FOR UPDATE TO authenticated
  USING (user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()));
DROP POLICY IF EXISTS user_barcode_foods_delete_owner ON public.user_barcode_foods;
CREATE POLICY user_barcode_foods_delete_owner ON public.user_barcode_foods FOR DELETE TO authenticated
  USING (user_id=(select auth.uid()));
COMMIT;
