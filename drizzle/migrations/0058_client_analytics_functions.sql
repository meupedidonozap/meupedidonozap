CREATE OR REPLACE FUNCTION public.client_mix_summary(p_store_id uuid, p_from date, p_to date)
RETURNS TABLE(cliente_codigo text, vendedor_codigo text, categoria text, valor numeric, quantidade numeric, notas bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT i.cliente_codigo, i.vendedor_codigo, COALESCE(c.name, 'SEM CATEGORIA'),
         SUM(i.valor_total), SUM(i.quantidade), COUNT(DISTINCT i.invoice_key)
  FROM customer_invoice_items i
  LEFT JOIN products p ON p.store_id = i.store_id AND p.code = i.produto_codigo
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE i.store_id = p_store_id AND i.data_emissao BETWEEN p_from AND p_to
  GROUP BY 1, 2, 3
$$;
CREATE OR REPLACE FUNCTION public.client_product_summary(p_store_id uuid, p_from date, p_to date)
RETURNS TABLE(vendedor_codigo text, produto_codigo text, produto_nome text, categoria text, valor numeric, quantidade numeric, clientes bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT i.vendedor_codigo, i.produto_codigo, COALESCE(MAX(p.name), i.produto_codigo), COALESCE(MAX(c.name), 'SEM CATEGORIA'),
         SUM(i.valor_total), SUM(i.quantidade), COUNT(DISTINCT i.cliente_codigo)
  FROM customer_invoice_items i
  LEFT JOIN products p ON p.store_id = i.store_id AND p.code = i.produto_codigo
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE i.store_id = p_store_id AND i.data_emissao BETWEEN p_from AND p_to
  GROUP BY 1, 2
$$;
GRANT EXECUTE ON FUNCTION public.client_mix_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_product_summary(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_client_analytics_settings(p_store_id uuid, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clean jsonb; v_goals jsonb := '{}'::jsonb; v_lines jsonb := '{}'::jsonb; k text; v jsonb; r numeric; b numeric;
BEGIN
  IF NOT (is_platform_admin(auth.uid()) OR is_store_admin(auth.uid(), p_store_id) OR is_store_manager(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND slug = 'dicolore') THEN
    RAISE EXCEPTION 'Recurso indisponível para esta loja';
  END IF;
  FOR k, v IN SELECT * FROM jsonb_each(COALESCE(p_settings->'goals', '{}'::jsonb)) LOOP
    IF length(k) > 30 THEN RAISE EXCEPTION 'Código inválido'; END IF;
    r := COALESCE((v->>'revenue')::numeric, 0); b := COALESCE((v->>'buyers')::numeric, 0);
    IF r < 0 OR r > 100000000 OR b < 0 OR b > 100000 THEN RAISE EXCEPTION 'Meta fora do limite'; END IF;
    v_goals := v_goals || jsonb_build_object(k, jsonb_build_object('revenue', r, 'buyers', b));
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(COALESCE(p_settings->'lineMap', '{}'::jsonb)) LOOP
    IF jsonb_typeof(v) <> 'string' OR length(k) > 120 OR length(v #>> '{}') > 60 THEN RAISE EXCEPTION 'Linha inválida'; END IF;
    IF btrim(v #>> '{}') <> '' THEN v_lines := v_lines || jsonb_build_object(k, btrim(v #>> '{}')); END IF;
  END LOOP;
  v_clean := jsonb_build_object('goals', v_goals, 'lineMap', v_lines);
  UPDATE stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{clientAnalytics}', v_clean) WHERE id = p_store_id;
  RETURN v_clean;
END $$;
REVOKE ALL ON FUNCTION public.save_client_analytics_settings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_analytics_settings(uuid, jsonb) TO authenticated;