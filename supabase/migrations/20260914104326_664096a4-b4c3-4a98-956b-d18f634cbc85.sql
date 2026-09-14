ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS payment_session_id text,
  ADD COLUMN IF NOT EXISTS payment_environment text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_service text,
  ADD COLUMN IF NOT EXISTS shipping_code text,
  ADD COLUMN IF NOT EXISTS shipping_deadline integer;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_session_unique
  ON public.orders(payment_environment, payment_session_id)
  WHERE payment_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders(store_id, payment_status, created_at DESC);