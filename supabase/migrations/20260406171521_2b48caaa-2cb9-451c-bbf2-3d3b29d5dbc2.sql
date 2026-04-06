
CREATE TABLE public.store_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  whatsapp text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active sellers" ON public.store_sellers
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Store admins manage sellers" ON public.store_sellers
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid(), store_id))
  WITH CHECK (is_store_admin(auth.uid(), store_id));
