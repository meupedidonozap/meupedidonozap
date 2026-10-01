CREATE OR REPLACE FUNCTION public.is_store_seller_code(_user_id uuid, _store_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _code IS NOT NULL AND _code <> '' AND EXISTS (
    SELECT 1 FROM public.store_users su
    WHERE su.user_id = _user_id AND su.store_id = _store_id AND su.is_active
      AND _code = ANY(su.seller_codes)
  )
$$;

CREATE POLICY "Sellers can read their orders" ON public.orders FOR SELECT TO authenticated
USING (public.is_store_seller_code(auth.uid(), store_id, customer->>'sellerCode'));

CREATE POLICY "Sellers can finalize their quotes" ON public.orders FOR UPDATE TO authenticated
USING (status = 'orcamento' AND public.is_store_seller_code(auth.uid(), store_id, customer->>'sellerCode'))
WITH CHECK (status IN ('orcamento','pendente','cancelado') AND public.is_store_seller_code(auth.uid(), store_id, customer->>'sellerCode'));