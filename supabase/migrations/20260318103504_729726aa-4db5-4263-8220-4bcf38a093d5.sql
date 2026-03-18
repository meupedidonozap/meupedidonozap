
CREATE TABLE public.store_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  page text DEFAULT '/',
  user_agent text DEFAULT '',
  ip_hash text DEFAULT ''
);

CREATE INDEX idx_store_visits_store_date ON public.store_visits (store_id, visited_at);

ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert store visits"
ON public.store_visits
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Store admins can read store visits"
ON public.store_visits
FOR SELECT
TO authenticated
USING (is_store_admin(auth.uid(), store_id));
