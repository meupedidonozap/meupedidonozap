ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
  FROM public.stores
)
UPDATE public.stores s SET sort_order = r.rn FROM ranked r WHERE s.id = r.id;

CREATE INDEX IF NOT EXISTS idx_stores_sort_order ON public.stores(sort_order);