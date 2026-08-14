ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_table_11 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_table_11 numeric NOT NULL DEFAULT 0;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.customer_profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%price_table%'
  LOOP
    EXECUTE format('ALTER TABLE public.customer_profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.customer_profiles
  ADD CONSTRAINT customer_profiles_price_table_check
  CHECK (price_table IN (1, 4, 9, 11));