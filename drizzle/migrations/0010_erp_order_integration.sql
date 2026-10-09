ALTER TABLE public.store_users ADD COLUMN IF NOT EXISTS erp_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS erp_order_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS erp_sent_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS erp_error text;
CREATE INDEX IF NOT EXISTS idx_orders_erp_pending ON public.orders(store_id, status) WHERE erp_sent_at IS NULL;