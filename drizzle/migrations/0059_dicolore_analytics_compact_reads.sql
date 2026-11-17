CREATE OR REPLACE FUNCTION public.client_invoice_analytics(p_store_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH dates AS (SELECT p_from - (p_to - p_from + 1) AS prev_from),
base AS MATERIALIZED (
 SELECT regexp_replace(btrim(cliente_codigo), '^0+(?=[0-9])', '') AS code, data_emissao AS day, valor_total_nota_fiscal AS value
 FROM public.customer_invoices WHERE store_id=p_store_id
 AND EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND slug='dicolore')
), stats AS (
 SELECT code, sum(value) AS history_revenue, count(*) AS history_orders,
 count(*) FILTER (WHERE day BETWEEN p_from AND p_to) AS orders,
 coalesce(sum(value) FILTER (WHERE day BETWEEN p_from AND p_to),0) AS revenue,
 count(*) FILTER (WHERE day >= (SELECT prev_from FROM dates) AND day < p_from) AS prev_orders,
 coalesce(sum(value) FILTER (WHERE day >= (SELECT prev_from FROM dates) AND day < p_from),0) AS prev_revenue,
 min(day) FILTER (WHERE day<=p_to) AS first_purchase,
 max(day) FILTER (WHERE day<=p_to) AS last_purchase,
 count(DISTINCT day) FILTER (WHERE day<=p_to) AS purchase_days
 FROM base GROUP BY code
), monthly AS (
 SELECT code, to_char(day,'YYYY-MM') AS month, sum(value) AS value FROM base WHERE day IS NOT NULL GROUP BY code,to_char(day,'YYYY-MM')
)
SELECT jsonb_build_object('summaries',coalesce((SELECT jsonb_agg(to_jsonb(stats)) FROM stats),'[]'::jsonb),'monthly',coalesce((SELECT jsonb_agg(to_jsonb(monthly)) FROM monthly),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.client_invoice_analytics(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_invoice_analytics(uuid,date,date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.attendance_history_summary(p_store_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH guard AS (SELECT id FROM public.stores WHERE id=p_store_id AND slug='dicolore'),
history AS (
 SELECT customer_profile_id, max((checked_in_at AT TIME ZONE 'America/Sao_Paulo')::date) AS last
 FROM public.customer_visits WHERE store_id=p_store_id AND store_id IN (SELECT id FROM guard)
 AND checked_in_at < ((p_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') GROUP BY customer_profile_id
), revenue AS (
 SELECT cliente_codigo, sum(valor_total_nota_fiscal) AS valor_total_nota_fiscal
 FROM public.customer_invoices WHERE store_id=p_store_id AND store_id IN (SELECT id FROM guard) AND data_emissao<=p_to
 AND lower(status) NOT IN ('101','cancelado','cancelada','canceled','cancelled','orcamento') GROUP BY cliente_codigo
), purchases AS (
 SELECT cliente_codigo, data_emissao FROM public.customer_invoices WHERE store_id=p_store_id AND store_id IN (SELECT id FROM guard)
 AND data_emissao BETWEEN p_from AND p_to AND lower(status) NOT IN ('101','cancelado','cancelada','canceled','cancelled','orcamento')
 UNION
 SELECT cliente_codigo, data_emissao FROM public.erp_orders WHERE store_id=p_store_id AND store_id IN (SELECT id FROM guard)
 AND data_emissao BETWEEN p_from AND p_to AND lower(status) NOT IN ('101','cancelado','cancelada','canceled','cancelled','orcamento')
)
SELECT jsonb_build_object('history',coalesce((SELECT jsonb_agg(to_jsonb(history)) FROM history),'[]'::jsonb),'revenue',coalesce((SELECT jsonb_agg(to_jsonb(revenue)) FROM revenue),'[]'::jsonb),'purchases',coalesce((SELECT jsonb_agg(to_jsonb(purchases)) FROM purchases),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.attendance_history_summary(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_history_summary(uuid,date,date) TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS orders_store_created_analytics_idx ON public.orders(store_id,created_at);
