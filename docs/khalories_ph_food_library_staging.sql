-- Khalories Z3.2: independently curated Philippine packaged foods.
-- Apply to STAGING only. Does not import/copy Open Food Facts' ODbL database.
-- A food appears in app ONLY after explicit review and status='published'.
BEGIN;
CREATE TABLE IF NOT EXISTS public.khalories_ph_food_library (
  barcode text PRIMARY KEY CHECK (barcode ~ '^[0-9]{8,14}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  brand text NOT NULL DEFAULT '' CHECK (char_length(brand) <= 80),
  flavor text NOT NULL DEFAULT '' CHECK (char_length(flavor) <= 80),
  serving_description text NOT NULL DEFAULT '' CHECK (char_length(serving_description) <= 80),
  package_description text NOT NULL DEFAULT '' CHECK (char_length(package_description) <= 80),
  calories_100g numeric(9,2) CHECK (calories_100g BETWEEN 0 AND 2000),
  protein_100g numeric(9,2) CHECK (protein_100g BETWEEN 0 AND 100),
  carbs_100g numeric(9,2) CHECK (carbs_100g BETWEEN 0 AND 100),
  fat_100g numeric(9,2) CHECK (fat_100g BETWEEN 0 AND 100),
  advanced_nutrients_100g jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(advanced_nutrients_100g) = 'object' AND pg_column_size(advanced_nutrients_100g) <= 2500),
  source_kind text NOT NULL CHECK (source_kind IN ('manufacturer_label','reviewed_package_label')),
  source_url text CHECK (source_url IS NULL OR (char_length(source_url) <= 500 AND source_url ~ '^https://')),
  source_notes text NOT NULL DEFAULT '' CHECK (char_length(source_notes) <= 800),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (calories_100g IS NOT NULL OR (protein_100g IS NOT NULL AND carbs_100g IS NOT NULL AND fat_100g IS NOT NULL)),
  CHECK (status <> 'published' OR (reviewed_at IS NOT NULL AND (source_url IS NOT NULL OR char_length(btrim(source_notes)) >= 10)))
);
CREATE INDEX IF NOT EXISTS khalories_ph_food_library_search_idx
  ON public.khalories_ph_food_library (lower(name) text_pattern_ops)
  WHERE status = 'published';
ALTER TABLE public.khalories_ph_food_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.khalories_ph_food_library FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.khalories_ph_food_library TO authenticated;
GRANT ALL ON public.khalories_ph_food_library TO service_role;
DROP POLICY IF EXISTS khalories_ph_food_library_published_read ON public.khalories_ph_food_library;
CREATE POLICY khalories_ph_food_library_published_read
ON public.khalories_ph_food_library FOR SELECT TO authenticated
USING (status = 'published');
COMMIT;
