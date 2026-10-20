ALTER TABLE public.customer_visits ADD COLUMN IF NOT EXISTS out_of_range_reason text, ADD COLUMN IF NOT EXISTS out_of_range_notes text;

CREATE TABLE public.customer_geo_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_profile_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.customer_visits(id) ON DELETE SET NULL,
  changed_by uuid NOT NULL,
  seller_name text,
  seller_code text,
  customer_name text,
  customer_code text,
  old_address text,
  old_lat numeric,
  old_lng numeric,
  new_lat numeric NOT NULL,
  new_lng numeric NOT NULL,
  new_address text,
  distance_meters numeric,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_geo_changes TO authenticated;
GRANT ALL ON public.customer_geo_changes TO service_role;
ALTER TABLE public.customer_geo_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own geo changes" ON public.customer_geo_changes FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() AND public.has_any_store_access(auth.uid(), store_id));
CREATE POLICY "View own or admin geo changes" ON public.customer_geo_changes FOR SELECT TO authenticated
  USING (changed_by = auth.uid() OR public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));
CREATE INDEX ON public.customer_geo_changes(store_id, created_at DESC);