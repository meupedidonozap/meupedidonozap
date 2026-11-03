CREATE OR REPLACE FUNCTION public.is_own_customer_code(_user_id uuid, _store_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NULLIF(btrim(_code),'') IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customer_profiles cp
    WHERE cp.user_id=_user_id AND cp.store_id=_store_id
      AND NULLIF(btrim(cp.customer_code),'') = btrim(_code));
$$;

CREATE POLICY "ERP orders visible to own customer" ON public.erp_orders
FOR SELECT TO authenticated USING (public.is_own_customer_code(auth.uid(), store_id, cliente_codigo));

CREATE POLICY "Orders visible to own customer code" ON public.orders
FOR SELECT TO authenticated USING (public.is_own_customer_code(auth.uid(), store_id, customer->>'customerCode'));