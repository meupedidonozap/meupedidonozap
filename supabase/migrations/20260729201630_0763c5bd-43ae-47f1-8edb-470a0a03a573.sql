ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_table_res numeric NULL;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_table_res numeric NULL;