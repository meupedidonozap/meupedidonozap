ALTER TABLE public.customer_titles ADD COLUMN IF NOT EXISTS valor_juros numeric NOT NULL DEFAULT 0;
ALTER TABLE public.customer_titles ADD COLUMN IF NOT EXISTS valor_pago_liquido numeric;
CREATE INDEX IF NOT EXISTS idx_customer_titles_store_quitacao ON public.customer_titles(store_id, data_quitacao);