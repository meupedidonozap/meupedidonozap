CREATE OR REPLACE FUNCTION public.client_lifecycle_days(p_store_id uuid, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH daily AS MATERIALIZED (
 SELECT regexp_replace(btrim(cliente_codigo), '^0+(?=[0-9])', '') AS code,
 data_emissao AS day, sum(valor_total_nota_fiscal) AS revenue, count(*) AS invoices
 FROM public.customer_invoices
 WHERE store_id = p_store_id AND data_emissao BETWEEN (p_to - interval '24 months')::date AND p_to
 AND p_to <= current_date
 AND EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND slug='dicolore')
 GROUP BY regexp_replace(btrim(cliente_codigo), '^0+(?=[0-9])', ''), data_emissao
), clients AS (
 SELECT code, jsonb_agg(jsonb_build_object('date',day,'revenue',revenue,'invoices',invoices) ORDER BY day) AS days
 FROM daily GROUP BY code
)
SELECT jsonb_build_object('from',(p_to - interval '24 months')::date,'to',p_to,
 'clients',coalesce((SELECT jsonb_agg(to_jsonb(clients)) FROM clients),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.client_lifecycle_days(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_lifecycle_days(uuid,date) TO authenticated, service_role;
COMMENT ON FUNCTION public.client_lifecycle_days(uuid,date) IS 'DiColore only; bounded 24-month purchase-day summary under invoice RLS. Missing purchases do not prove lifetime inactivity.';