ALTER TABLE public.bling_connections ADD COLUMN IF NOT EXISTS last_product_sync_at timestamptz;
ALTER TABLE public.bling_connections ADD COLUMN IF NOT EXISTS pending_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bling_connections ADD COLUMN IF NOT EXISTS last_customer_sync_at timestamptz;