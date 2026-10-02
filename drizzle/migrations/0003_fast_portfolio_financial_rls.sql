CREATE OR REPLACE FUNCTION public.portfolio_customer_keys(_user_id uuid)
RETURNS TABLE(store_id uuid, customer_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT cp.store_id, btrim(cp.customer_code)
  FROM public.store_users su
  JOIN public.customer_profiles cp ON cp.store_id = su.store_id
  WHERE su.user_id = _user_id AND su.is_active
    AND su.role IN ('vendedor','televendas')
    AND NULLIF(btrim(cp.customer_code),'') IS NOT NULL
    AND NULLIF(btrim(cp.seller_code),'') IS NOT NULL
    AND btrim(cp.seller_code) = ANY (SELECT btrim(c) FROM unnest(su.seller_codes) c)
$$;
REVOKE EXECUTE ON FUNCTION public.portfolio_customer_keys(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.portfolio_customer_keys(uuid) TO authenticated;

DROP POLICY IF EXISTS "Titles visible through customer portfolio" ON public.customer_titles;
CREATE POLICY "Titles visible through customer portfolio" ON public.customer_titles
FOR SELECT TO authenticated
USING ((store_id, cliente_codigo) IN (SELECT k.store_id, k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k));

DROP POLICY IF EXISTS "Invoices visible through customer portfolio" ON public.customer_invoices;
CREATE POLICY "Invoices visible through customer portfolio" ON public.customer_invoices
FOR SELECT TO authenticated
USING ((store_id, cliente_codigo) IN (SELECT k.store_id, k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k));

CREATE INDEX IF NOT EXISTS idx_customer_titles_store_due ON public.customer_titles (store_id, data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_store_seller ON public.customer_profiles (store_id, seller_code);