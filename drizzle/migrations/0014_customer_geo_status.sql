ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS geo_status text,
  ADD COLUMN IF NOT EXISTS geo_error text,
  ADD COLUMN IF NOT EXISTS geo_formatted text,
  ADD COLUMN IF NOT EXISTS geo_attempted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_customer_profiles_geo_pending ON public.customer_profiles(store_id, geo_status) WHERE geo_lat IS NULL;