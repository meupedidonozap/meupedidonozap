ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS seller_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_televendas boolean NOT NULL DEFAULT false;