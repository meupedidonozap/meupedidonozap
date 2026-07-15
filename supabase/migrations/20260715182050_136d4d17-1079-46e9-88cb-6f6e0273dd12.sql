
-- 1. Products: 3 price tables (backfill from base_price)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_table_1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_table_4 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_table_9 numeric NOT NULL DEFAULT 0;

UPDATE public.products
   SET price_table_1 = base_price,
       price_table_4 = base_price,
       price_table_9 = base_price
 WHERE price_table_4 = 0;

-- 2. Product variants: 3 price tables (backfill from price)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_table_1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_table_4 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_table_9 numeric NOT NULL DEFAULT 0;

UPDATE public.product_variants
   SET price_table_1 = price,
       price_table_4 = price,
       price_table_9 = price
 WHERE price_table_4 = 0;

-- 3. Customer profiles: price_table attribute (default 4)
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS price_table smallint NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_profiles_price_table_check'
  ) THEN
    ALTER TABLE public.customer_profiles
      ADD CONSTRAINT customer_profiles_price_table_check
      CHECK (price_table IN (1, 4, 9));
  END IF;
END $$;

-- 4. Discount rules backfill: add priceTable=4 to every rule in stores.settings.discountRules that lacks it
UPDATE public.stores s
   SET settings = jsonb_set(
         s.settings,
         '{discountRules}',
         COALESCE((
           SELECT jsonb_agg(
             CASE
               WHEN (rule ? 'priceTable') THEN rule
               ELSE rule || jsonb_build_object('priceTable', 4)
             END
           )
           FROM jsonb_array_elements(s.settings->'discountRules') rule
         ), '[]'::jsonb)
       )
 WHERE jsonb_typeof(s.settings->'discountRules') = 'array'
   AND jsonb_array_length(s.settings->'discountRules') > 0;
