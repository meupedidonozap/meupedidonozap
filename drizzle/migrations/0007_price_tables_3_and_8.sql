ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_table_3 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_table_8 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_table_3 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_table_8 numeric NOT NULL DEFAULT 0;