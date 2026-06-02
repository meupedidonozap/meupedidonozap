CREATE TABLE public.order_create_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid,
  error_message text NOT NULL DEFAULT '',
  error_code text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_create_errors_store_created
  ON public.order_create_errors(store_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.order_create_errors TO authenticated;
GRANT INSERT ON public.order_create_errors TO anon;
GRANT ALL ON public.order_create_errors TO service_role;

ALTER TABLE public.order_create_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log order errors"
  ON public.order_create_errors
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Store admins can read order errors"
  ON public.order_create_errors
  FOR SELECT
  TO authenticated
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can delete order errors"
  ON public.order_create_errors
  FOR DELETE
  TO authenticated
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));