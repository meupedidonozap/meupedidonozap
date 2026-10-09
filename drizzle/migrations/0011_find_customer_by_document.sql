CREATE OR REPLACE FUNCTION public.find_customer_by_document(p_store_id uuid, p_doc text)
RETURNS TABLE(name text, customer_code text, seller_code text, seller_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT cp.name, cp.customer_code, cp.seller_code,
    (SELECT s.name FROM public.store_sellers s WHERE s.store_id = cp.store_id AND btrim(s.code) = btrim(cp.seller_code) AND btrim(cp.seller_code) <> '' LIMIT 1)
  FROM public.customer_profiles cp
  WHERE cp.store_id = p_store_id
    AND public.has_any_store_access(auth.uid(), p_store_id)
    AND length(regexp_replace(coalesce(p_doc,''), '\D', '', 'g')) IN (11, 14)
    AND regexp_replace(cp.cpf_cnpj, '\D', '', 'g') = regexp_replace(p_doc, '\D', '', 'g')
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.find_customer_by_document(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_document(uuid, text) TO authenticated;