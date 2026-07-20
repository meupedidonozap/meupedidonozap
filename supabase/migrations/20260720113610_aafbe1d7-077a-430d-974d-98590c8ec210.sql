
-- 1. Add geolocation cache columns to customer_profiles
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS geo_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS geo_lng NUMERIC;

-- 2. Create customer_visits
CREATE TABLE IF NOT EXISTS public.customer_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  seller_code TEXT,
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,
  checkin_lat NUMERIC,
  checkin_lng NUMERIC,
  checkout_lat NUMERIC,
  checkout_lng NUMERIC,
  distance_meters_at_checkin NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_visits_store_idx ON public.customer_visits(store_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS customer_visits_seller_idx ON public.customer_visits(seller_user_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS customer_visits_customer_idx ON public.customer_visits(customer_profile_id, checked_in_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_visits TO authenticated;
GRANT ALL ON public.customer_visits TO service_role;

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;

-- Sellers manage their own visits
CREATE POLICY "Seller can view own visits" ON public.customer_visits
  FOR SELECT TO authenticated
  USING (seller_user_id = auth.uid());

CREATE POLICY "Seller can insert own visits" ON public.customer_visits
  FOR INSERT TO authenticated
  WITH CHECK (seller_user_id = auth.uid());

CREATE POLICY "Seller can update own visits" ON public.customer_visits
  FOR UPDATE TO authenticated
  USING (seller_user_id = auth.uid())
  WITH CHECK (seller_user_id = auth.uid());

-- Store admins / platform admins can view all store visits
CREATE POLICY "Store admins can view all visits" ON public.customer_visits
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_store_admin(auth.uid(), store_id)
  );

CREATE POLICY "Store admins can update all visits" ON public.customer_visits
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_store_admin(auth.uid(), store_id)
  );

CREATE POLICY "Store admins can delete visits" ON public.customer_visits
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_store_admin(auth.uid(), store_id)
  );

CREATE TRIGGER update_customer_visits_updated_at
  BEFORE UPDATE ON public.customer_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
