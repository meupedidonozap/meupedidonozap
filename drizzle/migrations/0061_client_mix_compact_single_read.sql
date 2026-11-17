CREATE OR REPLACE FUNCTION public.client_mix_analytics(p_store_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH totals AS MATERIALIZED (
 SELECT cliente_codigo,vendedor_codigo,produto_codigo,
 CASE WHEN data_emissao>=p_from THEN 'cur' ELSE 'prev' END AS period,
 sum(valor_total) AS valor,sum(quantidade) AS quantidade
 FROM public.customer_invoice_items
 WHERE store_id=p_store_id AND data_emissao BETWEEN p_from-(p_to-p_from+1) AND p_to AND p_from<=p_to
 AND EXISTS(SELECT 1 FROM public.stores WHERE id=p_store_id AND slug='dicolore')
 GROUP BY 1,2,3,4
), catalog AS MATERIALIZED (
 SELECT p.code,p.name,coalesce(c.name,'SEM CATEGORIA') AS categoria FROM public.products p
 LEFT JOIN public.categories c ON c.id=p.category_id WHERE p.store_id=p_store_id
), enriched AS MATERIALIZED (
 SELECT t.*,coalesce(c.name,t.produto_codigo) AS produto_nome,coalesce(c.categoria,'SEM CATEGORIA') AS categoria
 FROM totals t LEFT JOIN catalog c ON c.code=t.produto_codigo
), mix AS (
 SELECT cliente_codigo,vendedor_codigo,categoria,period,sum(valor) AS valor,sum(quantidade) AS quantidade
 FROM enriched GROUP BY 1,2,3,4
), products AS (
 SELECT vendedor_codigo,produto_codigo,max(produto_nome) AS produto_nome,max(categoria) AS categoria,period,
 sum(valor) AS valor,sum(quantidade) AS quantidade,count(DISTINCT cliente_codigo) AS clientes
 FROM enriched GROUP BY vendedor_codigo,produto_codigo,period
)
SELECT jsonb_build_object(
'mixCur',coalesce((SELECT jsonb_agg(to_jsonb(m)-'period') FROM mix m WHERE period='cur'),'[]'::jsonb),
'mixPrev',coalesce((SELECT jsonb_agg(to_jsonb(m)-'period') FROM mix m WHERE period='prev'),'[]'::jsonb),
'prodCur',coalesce((SELECT jsonb_agg(to_jsonb(p)-'period') FROM products p WHERE period='cur'),'[]'::jsonb),
'prodPrev',coalesce((SELECT jsonb_agg(to_jsonb(p)-'period') FROM products p WHERE period='prev'),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.client_mix_analytics(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_mix_analytics(uuid,date,date) TO authenticated,service_role;