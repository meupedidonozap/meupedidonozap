ALTER TABLE public.erp_orders ADD COLUMN IF NOT EXISTS pedido_televendas boolean NOT NULL DEFAULT false;
ALTER TABLE public.erp_orders ADD COLUMN IF NOT EXISTS televendas_codigo text;
CREATE INDEX IF NOT EXISTS erp_orders_tv_idx ON public.erp_orders (store_id, televendas_codigo, data_emissao);