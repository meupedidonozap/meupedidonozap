ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS erp_sent_at timestamptz;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS erp_error text;
CREATE INDEX IF NOT EXISTS idx_customer_profiles_pending_erp ON public.customer_profiles (store_id, created_at) WHERE coalesce(customer_code,'') = '' AND erp_sent_at IS NULL;