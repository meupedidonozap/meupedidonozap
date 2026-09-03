CREATE OR REPLACE FUNCTION public.force_senses_price_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id AND s.slug = 'dicoloresenses') THEN
    NEW.price_table := 11;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_senses_price_table ON public.customer_profiles;
CREATE TRIGGER trg_force_senses_price_table
BEFORE INSERT OR UPDATE ON public.customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.force_senses_price_table();