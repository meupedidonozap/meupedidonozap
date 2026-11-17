CREATE OR REPLACE FUNCTION public.client_invoice_analytics(p_store_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH dates AS (SELECT p_from - (p_to - p_from + 1) AS prev_from),
base AS MATERIALIZED (
 SELECT regexp_replace(btrim(cliente_codigo), '^0+(?=[0-9])', '') AS code, data_emissao AS day, valor_total_nota_fiscal AS value
 FROM public.customer_invoices WHERE store_id=p_store_id
 AND data_emissao BETWEEN (SELECT prev_from FROM dates) AND p_to
 AND p_from <= p_to
 AND EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND slug='dicolore')
), stats AS (
 SELECT code, sum(value) AS history_revenue, count(*) AS history_orders,
 count(*) FILTER (WHERE day BETWEEN p_from AND p_to) AS orders,
 coalesce(sum(value) FILTER (WHERE day BETWEEN p_from AND p_to),0) AS revenue,
 count(*) FILTER (WHERE day < p_from) AS prev_orders,
 coalesce(sum(value) FILTER (WHERE day < p_from),0) AS prev_revenue,
 min(day) AS first_purchase, max(day) AS last_purchase, count(DISTINCT day) AS purchase_days
 FROM base GROUP BY code
), monthly AS (
 SELECT code, to_char(day,'YYYY-MM') AS month, sum(value) AS value FROM base GROUP BY code,to_char(day,'YYYY-MM')
)
SELECT jsonb_build_object('summaries',coalesce((SELECT jsonb_agg(to_jsonb(stats)) FROM stats),'[]'::jsonb),'monthly',coalesce((SELECT jsonb_agg(to_jsonb(monthly)) FROM monthly),'[]'::jsonb),'history_from',(SELECT prev_from FROM dates),'history_to',p_to);
$$;
REVOKE ALL ON FUNCTION public.client_invoice_analytics(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_invoice_analytics(uuid,date,date) TO authenticated,service_role;