BEGIN;

ALTER TABLE public.meals
ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

UPDATE public.meals
SET consumed_at = created_at
WHERE consumed_at IS NULL;

ALTER TABLE public.meals
ALTER COLUMN consumed_at SET DEFAULT now();

ALTER TABLE public.meals
ALTER COLUMN consumed_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS meals_user_consumed_at_idx
ON public.meals (user_id, consumed_at DESC);

COMMIT;