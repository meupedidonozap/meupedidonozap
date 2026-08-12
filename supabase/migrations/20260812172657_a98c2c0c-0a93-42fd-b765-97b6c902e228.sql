ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS ie text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'Un';