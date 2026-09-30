ALTER TABLE public.customer_visits
  ADD COLUMN IF NOT EXISTS checkout_reason text,
  ADD COLUMN IF NOT EXISTS checkout_notes text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;