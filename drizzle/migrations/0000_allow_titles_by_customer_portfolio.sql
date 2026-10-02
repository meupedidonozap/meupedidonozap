CREATE OR REPLACE FUNCTION public.has_customer_portfolio_access(_user_id uuid, _store_id uuid, _customer_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_profiles cp
    JOIN public.store_users su
      ON su.store_id = cp.store_id
     AND su.user_id = _user_id
     AND su.is_active = true
     AND su.role IN ('vendedor', 'televendas')
    WHERE cp.store_id = _store_id
      AND NULLIF(btrim(cp.customer_code), '') IS NOT NULL
      AND btrim(cp.customer_code) = btrim(_customer_code)
      AND NULLIF(btrim(cp.seller_code), '') IS NOT NULL
      AND btrim(cp.seller_code) = ANY (
        SELECT btrim(code)
        FROM unnest(su.seller_codes) AS code
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_customer_portfolio_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_customer_portfolio_access(uuid, uuid, text) TO service_role;

CREATE POLICY "Titles visible through customer portfolio"
ON public.customer_titles
FOR SELECT
TO authenticated
USING (public.has_customer_portfolio_access(auth.uid(), store_id, cliente_codigo));