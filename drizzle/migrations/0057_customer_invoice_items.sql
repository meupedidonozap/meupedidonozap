CREATE TABLE public.customer_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  invoice_key text NOT NULL,
  external_key text NOT NULL,
  cliente_codigo text NOT NULL DEFAULT '',
  vendedor_codigo text NOT NULL DEFAULT '',
  data_emissao date,
  produto_codigo text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  comissao_valor numeric NOT NULL DEFAULT 0,
  cfop text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_key)
);
CREATE INDEX customer_invoice_items_inv ON public.customer_invoice_items(store_id, invoice_key);
CREATE INDEX customer_invoice_items_date ON public.customer_invoice_items(store_id, data_emissao);
GRANT SELECT ON public.customer_invoice_items TO authenticated;
GRANT ALL ON public.customer_invoice_items TO service_role;
ALTER TABLE public.customer_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoice items by invoice seller" ON public.customer_invoice_items FOR SELECT TO authenticated
USING (CASE WHEN EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.slug = 'dicolore')
  THEN public.has_invoice_seller_access(auth.uid(), store_id, vendedor_codigo)
  ELSE (store_id, cliente_codigo) IN (SELECT k.store_id, k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k) END);
CREATE POLICY "Invoice items own customer" ON public.customer_invoice_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_profiles cp WHERE cp.user_id = auth.uid() AND cp.store_id = customer_invoice_items.store_id AND NULLIF(btrim(cp.customer_code),'') IS NOT NULL AND btrim(cp.customer_code) = btrim(customer_invoice_items.cliente_codigo)));
CREATE POLICY "Invoice items admins managers" ON public.customer_invoice_items FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id) OR public.is_store_manager(auth.uid(), store_id));